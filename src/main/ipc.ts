import { BrowserWindow, dialog, ipcMain, safeStorage, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AgentEvent,
  AgentStatus,
  ApiMessage,
  ChangeEntry,
  FileEntry,
  ProviderId,
  ProviderView,
  SessionData,
  SettingsView
} from '@shared/types'
import {
  PROVIDERS,
  PROVIDER_IDS,
  clientHeaders,
  fallbackModels,
  fetchModels,
  type FetchModelsResult
} from './providers'
import { createSettingsStore, type SecretCodec } from './settings'
import { createSessionStore, deriveTitle, emptyUsage } from './sessions'
import { createStreamChat } from './openai-client'
import { buildSystemPrompt } from './agent/prompt'
import { runAgent } from './agent/loop'
import { normalizeRoot, resolveInRoot } from './sandbox'
import type { ProposedChange } from './tools/types'

interface CachedModels extends FetchModelsResult {
  at: number
}

const MODEL_CACHE_TTL = 5 * 60 * 1000

export function registerIpc(): void {
  const dataDir = app.getPath('userData')
  const sessionsDir = path.join(dataDir, 'sessions')

  const codec: SecretCodec = {
    available: safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encoded) => safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  }

  const settings = createSettingsStore(dataDir, codec)
  const store = createSessionStore(sessionsDir)

  const runs = new Map<string, AbortController>()
  const approvals = new Map<string, (approved: boolean, applyAll: boolean) => void>()
  const applyAll = new Set<string>()
  const modelCache = new Map<ProviderId, CachedModels>()

  let watcher: fs.FSWatcher | null = null
  let watchTimer: NodeJS.Timeout | null = null
  const IGNORED_WATCH = /(^|[\\/])(node_modules|\.git|out|dist|release)([\\/]|$)/

  function emit(event: AgentEvent): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('agent:event', event)
    }
  }

  function closeWatcher(): void {
    if (watcher) {
      watcher.close()
      watcher = null
    }
    if (watchTimer) {
      clearTimeout(watchTimer)
      watchTimer = null
    }
  }

  function activateWorkspace(dir: string | null): void {
    closeWatcher()
    if (!dir) return
    let root: string
    try {
      root = normalizeRoot(dir)
    } catch {
      return
    }
    try {
      watcher = fs.watch(root, { recursive: true }, (_eventType, filename) => {
        if (filename && IGNORED_WATCH.test(filename)) return
        if (watchTimer) clearTimeout(watchTimer)
        watchTimer = setTimeout(() => {
          watchTimer = null
          emit({ type: 'fs-refresh' })
        }, 400)
      })
      watcher.on('error', () => closeWatcher())
    } catch {
      watcher = null
    }
  }

  function invalidateCache(provider: ProviderId): void {
    modelCache.delete(provider)
  }

  async function modelsFor(provider: ProviderId): Promise<FetchModelsResult> {
    const cached = modelCache.get(provider)
    if (cached && Date.now() - cached.at < MODEL_CACHE_TTL) return cached
    const key = settings.getKey(provider)
    if (!key) return { models: fallbackModels(provider) }
    const result = await fetchModels(provider, settings.getBaseURL(provider), key, settings.getClientId())
    modelCache.set(provider, { ...result, at: Date.now() })
    return result
  }

  async function buildSettingsView(): Promise<SettingsView> {
    const providers: ProviderView[] = []
    for (const id of PROVIDER_IDS) {
      const hasKey = settings.hasKey(id)
      const result = await modelsFor(id)
      providers.push({
        id,
        label: PROVIDERS[id].label,
        baseURL: settings.getBaseURL(id),
        hasKey,
        models: result.models,
        modelsError: result.error
      })
    }
    return {
      providers,
      defaultProvider: settings.getDefaultProvider(),
      defaultModel: settings.getDefaultModel()
    }
  }

  function readAgentsMd(root: string): string | null {
    for (const name of ['AGENTS.md', 'agents.md']) {
      const file = path.join(root, name)
      try {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
      } catch {
        /* ignore */
      }
    }
    return null
  }

  async function runSession(sessionId: string, text: string): Promise<void> {
    const session = store.get(sessionId)
    if (!session) return

    const fail = (message: string): void => {
      emit({ type: 'status', sessionId, status: 'error', error: message })
    }

    if (!session.workspace) {
      fail('Не выбрана папка проекта. Нажмите «Папка» в шапке.')
      return
    }
    const apiKey = settings.getKey(session.provider)
    if (!apiKey) {
      fail(`Не задан API-ключ для ${PROVIDERS[session.provider].label}. Откройте настройки.`)
      return
    }

    let root: string
    try {
      root = normalizeRoot(session.workspace)
    } catch (error) {
      fail((error as Error).message)
      return
    }
    activateWorkspace(session.workspace)

    const userMessage: ApiMessage = { role: 'user', content: text }
    session.messages.push(userMessage)
    deriveTitle(session)
    store.save(session)
    emit({ type: 'message', sessionId, message: userMessage })
    emit({ type: 'status', sessionId, status: 'thinking' })

    const controller = new AbortController()
    runs.set(sessionId, controller)

    const messages: ApiMessage[] = [
      { role: 'system', content: buildSystemPrompt(root, readAgentsMd(root)) },
      ...session.messages
    ]

    const streamChat = createStreamChat({
      apiKey,
      baseURL: settings.getBaseURL(session.provider),
      model: session.model,
      defaultHeaders: clientHeaders(session.provider, session.id)
    })

    try {
      await runAgent({
        messages,
        ctx: { root },
        streamChat,
        signal: controller.signal,
        onText: (delta) => emit({ type: 'text', sessionId, delta }),
        onReasoning: (delta) => emit({ type: 'reasoning', sessionId, delta }),
        onMessage: (message) => emit({ type: 'message', sessionId, message }),
        onToolStart: (call) =>
          emit({ type: 'tool-start', sessionId, id: call.id, name: call.name, args: call.args }),
        onToolEnd: (call, outcome) =>
          emit({
            type: 'tool-end',
            sessionId,
            id: call.id,
            name: call.name,
            output: outcome.output,
            isError: outcome.isError
          }),
        onUsage: (usage) => {
          session.usage = {
            promptTokens: usage.prompt,
            completionTokens: usage.completion,
            totalTokens: usage.total,
            contextLength: session.usage.contextLength
          }
          store.save(session)
          emit({ type: 'usage', sessionId, usage: session.usage })
        },
        onApplied: (change) => recordChange(session, change),
        requestApproval: (change) => requestApproval(sessionId, change)
      })

      session.messages = messages.slice(1)
      store.save(session)
      emit({ type: 'status', sessionId, status: controller.signal.aborted ? 'aborted' : 'idle' })
    } catch (error) {
      session.messages = messages.slice(1)
      store.save(session)
      if (controller.signal.aborted) {
        emit({ type: 'status', sessionId, status: 'aborted' })
      } else {
        emit({ type: 'status', sessionId, status: 'error', error: (error as Error).message })
      }
    } finally {
      runs.delete(sessionId)
    }
  }

  function recordChange(session: SessionData, change: ProposedChange): void {
    const entry: ChangeEntry = {
      id: randomUUID(),
      path: change.path,
      tool: change.tool,
      before: change.before,
      after: change.after,
      createdAt: Date.now()
    }
    session.changes.push(entry)
    store.save(session)
    emit({ type: 'change', sessionId: session.id, change: entry })
  }

  function requestApproval(sessionId: string, change: ProposedChange): Promise<boolean> {
    if (applyAll.has(sessionId)) return Promise.resolve(true)
    const id = randomUUID()
    return new Promise<boolean>((resolve) => {
      approvals.set(id, (approved, alsoApplyAll) => {
        approvals.delete(id)
        if (alsoApplyAll) applyAll.add(sessionId)
        resolve(approved)
      })
      emit({
        type: 'approval',
        sessionId,
        request: {
          id,
          sessionId,
          path: change.path,
          tool: change.tool,
          before: change.before,
          after: change.after
        }
      })
    })
  }

  ipcMain.handle('settings:get', () => buildSettingsView())

  ipcMain.handle('settings:saveKey', async (_e, provider: ProviderId, key: string) => {
    settings.setKey(provider, key)
    invalidateCache(provider)
    return buildSettingsView()
  })

  ipcMain.handle('settings:testKey', async (_e, provider: ProviderId, key: string) => {
    if (!key) return { ok: false, error: 'Пустой ключ', models: [] }
    const result = await fetchModels(provider, settings.getBaseURL(provider), key, settings.getClientId())
    return { ok: !result.error, error: result.error, models: result.models }
  })

  ipcMain.handle('settings:setBaseURL', async (_e, provider: ProviderId, url: string) => {
    settings.setBaseURL(provider, url)
    invalidateCache(provider)
    return buildSettingsView()
  })

  ipcMain.handle('settings:setDefaults', async (_e, provider: ProviderId, model: string) => {
    settings.setDefaults(provider, model)
    return buildSettingsView()
  })

  ipcMain.handle('workspace:pick', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Выберите папку проекта'
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('workspace:set', async (_e, sessionId: string, dir: string | null) => {
    const session = store.get(sessionId)
    if (!session) throw new Error('Сессия не найдена')
    session.workspace = dir
    store.save(session)
    activateWorkspace(dir)
    emit({ type: 'session', sessionId, session })
    return session
  })

  ipcMain.handle('sessions:list', () => store.list())

  ipcMain.handle('sessions:create', async (_e, provider?: ProviderId, model?: string) => {
    const p = provider ?? settings.getDefaultProvider()
    const m = model ?? settings.getDefaultModel()
    return store.create(p, m)
  })

  ipcMain.handle('sessions:get', (_e, id: string) => {
    const session = store.get(id)
    if (session?.workspace) activateWorkspace(session.workspace)
    return session
  })

  ipcMain.handle('sessions:setModel', async (_e, id: string, provider: ProviderId, model: string) => {
    const session = store.get(id)
    if (!session) throw new Error('Сессия не найдена')
    session.provider = provider
    session.model = model
    session.usage = emptyUsage(model)
    store.save(session)
    emit({ type: 'session', sessionId: id, session })
    return session
  })

  ipcMain.handle('sessions:delete', (_e, id: string) => {
    runs.get(id)?.abort()
    store.remove(id)
    return store.list()
  })

  ipcMain.handle('sessions:clearAll', () => {
    for (const controller of runs.values()) controller.abort()
    store.clearAll()
    return store.list()
  })

  ipcMain.handle('agent:send', (_e, sessionId: string, text: string) => {
    void runSession(sessionId, text)
  })

  ipcMain.handle('agent:abort', (_e, sessionId: string) => {
    runs.get(sessionId)?.abort()
  })

  ipcMain.handle('agent:approval', (_e, requestId: string, approved: boolean, alsoApplyAll: boolean) => {
    approvals.get(requestId)?.(approved, alsoApplyAll)
  })

  ipcMain.handle('changes:revert', (_e, sessionId: string, changeId: string) => {
    const session = store.get(sessionId)
    if (!session) throw new Error('Сессия не найдена')
    if (!session.workspace) throw new Error('Папка проекта не выбрана')
    const change = session.changes.find((item) => item.id === changeId)
    if (!change) throw new Error('Изменение не найдено')

    const root = normalizeRoot(session.workspace)
    const abs = resolveInRoot(root, change.path)
    if (change.before === null) {
      fs.rmSync(abs, { force: true })
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, change.before, 'utf8')
    }
    change.reverted = true
    store.save(session)
    emit({ type: 'session', sessionId, session })
    return session
  })

  ipcMain.handle('changes:apply', (_e, sessionId: string, changeId: string) => {
    const session = store.get(sessionId)
    if (!session) throw new Error('Сессия не найдена')
    if (!session.workspace) throw new Error('Папка проекта не выбрана')
    const change = session.changes.find((item) => item.id === changeId)
    if (!change) throw new Error('Изменение не найдено')

    const root = normalizeRoot(session.workspace)
    const abs = resolveInRoot(root, change.path)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, change.after, 'utf8')
    change.reverted = false
    store.save(session)
    emit({ type: 'session', sessionId, session })
    return session
  })

  ipcMain.handle('fs:readDir', (_e, sessionId: string, relPath: string) => {
    try {
      const session = store.get(sessionId)
      if (!session?.workspace) return []
      const root = normalizeRoot(session.workspace)
      const dir = resolveInRoot(root, relPath || '.')
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const result: FileEntry[] = entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => ({
          name: entry.name,
          path: path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/'),
          isDir: entry.isDirectory()
        }))
      result.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return result
    } catch {
      return []
    }
  })

  app.on('will-quit', closeWatcher)
}

export { PROVIDER_IDS }
export type { AgentStatus }
