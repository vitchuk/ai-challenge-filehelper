import { create } from 'zustand'
import type {
  AgentEvent,
  AgentStatus,
  ApiMessage,
  ApprovalRequest,
  FileEntry,
  ProviderId,
  SessionData,
  SessionSummary,
  SettingsView
} from '@shared/types'

export interface LiveTurn {
  text: string
  reasoning: string
}

export interface RunningTool {
  id: string
  name: string
  args: string
}

interface State {
  ready: boolean
  settings: SettingsView | null
  settingsOpen: boolean
  sessions: SessionSummary[]
  active: SessionData | null
  live: LiveTurn
  running: RunningTool[]
  approval: ApprovalRequest | null
  status: AgentStatus
  error: string | null
  dirEntries: FileEntry[]
  expanded: Record<string, FileEntry[]>

  init(): Promise<void>
  refreshSettings(): Promise<void>
  refreshSessions(): Promise<void>
  openSettings(open: boolean): void

  saveKey(provider: ProviderId, key: string): Promise<void>
  testKey(provider: ProviderId, key: string): Promise<{ ok: boolean; error?: string }>
  setBaseURL(provider: ProviderId, url: string): Promise<void>
  setDefaults(provider: ProviderId, model: string): Promise<void>

  newSession(): Promise<void>
  selectSession(id: string): Promise<void>
  deleteSession(id: string): Promise<void>
  clearSessions(): Promise<void>
  setModel(provider: ProviderId, model: string): Promise<void>

  pickWorkspace(): Promise<void>
  loadDir(path: string): Promise<void>
  toggleDir(path: string): Promise<void>

  send(text: string): Promise<void>
  stop(): Promise<void>
  respond(approved: boolean, applyAll: boolean): Promise<void>
  revert(changeId: string): Promise<void>
  apply(changeId: string): Promise<void>
}

const emptyLive: LiveTurn = { text: '', reasoning: '' }

export const useStore = create<State>((set, get) => {
  function refreshTree(): void {
    const state = get()
    if (!state.active?.workspace) return
    void state.loadDir('')
    for (const key of Object.keys(state.expanded)) void state.loadDir(key)
  }

  function applyEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'text':
        set((state) => ({ live: { ...state.live, text: state.live.text + event.delta } }))
        break
      case 'reasoning':
        set((state) => ({ live: { ...state.live, reasoning: state.live.reasoning + event.delta } }))
        break
      case 'message':
        set((state) => {
          if (!state.active || state.active.id !== event.sessionId) return {}
          const messages: ApiMessage[] = [...state.active.messages, event.message]
          return {
            active: { ...state.active, messages },
            live: event.message.role === 'assistant' ? emptyLive : state.live
          }
        })
        break
      case 'tool-start':
        set((state) => ({
          running: [...state.running, { id: event.id, name: event.name, args: event.args }]
        }))
        break
      case 'tool-end':
        set((state) => ({ running: state.running.filter((tool) => tool.id !== event.id) }))
        break
      case 'approval':
        set({ approval: event.request })
        break
      case 'change':
        set((state) =>
          state.active && state.active.id === event.sessionId
            ? { active: { ...state.active, changes: [...state.active.changes, event.change] } }
            : {}
        )
        refreshTree()
        break
      case 'fs-refresh':
        refreshTree()
        break
      case 'usage':
        set((state) =>
          state.active && state.active.id === event.sessionId
            ? { active: { ...state.active, usage: event.usage } }
            : {}
        )
        break
      case 'session':
        set((state) => ({
          active: state.active?.id === event.sessionId ? event.session : state.active,
          sessions: state.sessions.map((item) =>
            item.id === event.sessionId ? { ...item, ...summarize(event.session) } : item
          )
        }))
        break
      case 'status':
        set((state) => ({
          status: event.status,
          error: event.status === 'error' ? event.error ?? 'Неизвестная ошибка' : null,
          running: event.status === 'thinking' ? state.running : [],
          approval: event.status === 'error' || event.status === 'aborted' ? null : state.approval
        }))
        if (event.status !== 'thinking') void get().refreshSessions()
        break
    }
  }

  return {
    ready: false,
    settings: null,
    settingsOpen: false,
    sessions: [],
    active: null,
    live: emptyLive,
    running: [],
    approval: null,
    status: 'idle',
    error: null,
    dirEntries: [],
    expanded: {},

    async init() {
      window.api.onEvent(applyEvent)
      await get().refreshSettings()
      let sessions = await window.api.listSessions()
      if (!sessions.length) {
        const settings = get().settings
        await window.api.createSession(
          settings?.defaultProvider ?? 'opencode-go',
          settings?.defaultModel ?? 'glm-5.3'
        )
        sessions = await window.api.listSessions()
      }
      const first = sessions[0]
      const active = first ? await window.api.getSession(first.id) : null
      set({ sessions, active: active ?? null, ready: true, status: 'idle' })
      if (active?.workspace) await get().loadDir('')
    },

    async refreshSettings() {
      set({ settings: await window.api.getSettings() })
    },

    async refreshSessions() {
      set({ sessions: await window.api.listSessions() })
    },

    openSettings(open) {
      set({ settingsOpen: open })
    },

    async saveKey(provider, key) {
      set({ settings: await window.api.saveKey(provider, key) })
    },

    async testKey(provider, key) {
      const result = await window.api.testKey(provider, key)
      return { ok: result.ok, error: result.error }
    },

    async setBaseURL(provider, url) {
      set({ settings: await window.api.setBaseURL(provider, url) })
    },

    async setDefaults(provider, model) {
      set({ settings: await window.api.setDefaults(provider, model) })
    },

    async newSession() {
      const settings = get().settings
      const session = await window.api.createSession(
        settings?.defaultProvider ?? 'opencode-go',
        settings?.defaultModel ?? 'glm-5.3'
      )
      set({
        sessions: await window.api.listSessions(),
        active: session,
        live: emptyLive,
        running: [],
        approval: null,
        status: 'idle',
        error: null,
        dirEntries: [],
        expanded: {}
      })
    },

    async selectSession(id) {
      const session = await window.api.getSession(id)
      set({
        active: session,
        live: emptyLive,
        running: [],
        approval: null,
        status: 'idle',
        error: null,
        dirEntries: [],
        expanded: {}
      })
      if (session?.workspace) await get().loadDir('')
    },

    async deleteSession(id) {
      const sessions = await window.api.deleteSession(id)
      set({ sessions })
      if (get().active?.id === id) {
        const next = sessions[0]
        if (next) await get().selectSession(next.id)
        else await get().newSession()
      }
    },

    async clearSessions() {
      await window.api.clearSessions()
      await get().newSession()
      set({ sessions: await window.api.listSessions() })
    },

    async setModel(provider, model) {
      const active = get().active
      if (!active) return
      const session = await window.api.setSessionModel(active.id, provider, model)
      set({ active: session })
    },

    async pickWorkspace() {
      const active = get().active
      if (!active) return
      const dir = await window.api.pickWorkspace()
      if (!dir) return
      const session = await window.api.setWorkspace(active.id, dir)
      set({ active: session, dirEntries: [], expanded: {} })
      await get().loadDir('')
      await get().refreshSessions()
    },

    async loadDir(path) {
      const active = get().active
      if (!active) return
      try {
        const entries = await window.api.readDir(active.id, path)
        if (path === '') set({ dirEntries: entries })
        else set((state) => ({ expanded: { ...state.expanded, [path]: entries } }))
      } catch {
        /* directory may have disappeared */
      }
    },

    async toggleDir(path) {
      const state = get()
      if (state.expanded[path]) {
        const expanded = { ...state.expanded }
        delete expanded[path]
        set({ expanded })
        return
      }
      await state.loadDir(path)
    },

    async send(text) {
      const active = get().active
      const trimmed = text.trim()
      if (!active || !trimmed) return
      set({ status: 'thinking', error: null, live: emptyLive })
      await window.api.sendMessage(active.id, trimmed)
    },

    async stop() {
      const active = get().active
      if (active) await window.api.abort(active.id)
    },

    async respond(approved, applyAll) {
      const request = get().approval
      if (!request) return
      set({ approval: null })
      await window.api.respondApproval(request.id, approved, applyAll)
    },

    async revert(changeId) {
      const active = get().active
      if (!active) return
      try {
        const session = await window.api.revertChange(active.id, changeId)
        set({ active: session })
        refreshTree()
      } catch (error) {
        set({ error: (error as Error).message })
      }
    },

    async apply(changeId) {
      const active = get().active
      if (!active) return
      try {
        const session = await window.api.applyChange(active.id, changeId)
        set({ active: session })
        refreshTree()
      } catch (error) {
        set({ error: (error as Error).message })
      }
    }
  }
})

function summarize(session: SessionData): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    workspace: session.workspace,
    provider: session.provider,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  }
}
