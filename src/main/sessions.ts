import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ProviderId, SessionData, SessionSummary } from '@shared/types'
import { contextLengthFor } from './providers'

export interface SessionStore {
  list(): SessionSummary[]
  create(provider: ProviderId, model: string): SessionData
  get(id: string): SessionData | null
  save(session: SessionData): void
  remove(id: string): void
  clearAll(): void
}

export function createSessionStore(dir: string): SessionStore {
  function file(id: string): string {
    return path.join(dir, `${id}.json`)
  }

  function ensureDir(): void {
    fs.mkdirSync(dir, { recursive: true })
  }

  function read(id: string): SessionData | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(file(id), 'utf8')) as SessionData
      parsed.messages ??= []
      parsed.changes ??= []
      parsed.usage ??= emptyUsage(parsed.model ?? '')
      return parsed
    } catch {
      return null
    }
  }

  function toSummary(session: SessionData): SessionSummary {
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

  return {
    list() {
      ensureDir()
      const summaries: SessionSummary[] = []
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json') || name === 'settings.json') continue
        const session = read(name.slice(0, -5))
        if (session) summaries.push(toSummary(session))
      }
      return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
    },
    create(provider, model) {
      ensureDir()
      const now = Date.now()
      const session: SessionData = {
        id: randomUUID(),
        title: 'Новый чат',
        workspace: null,
        provider,
        model,
        messages: [],
        changes: [],
        usage: emptyUsage(model),
        createdAt: now,
        updatedAt: now
      }
      fs.writeFileSync(file(session.id), JSON.stringify(session, null, 2), 'utf8')
      return session
    },
    get(id) {
      return read(id)
    },
    save(session) {
      ensureDir()
      session.updatedAt = Date.now()
      fs.writeFileSync(file(session.id), JSON.stringify(session, null, 2), 'utf8')
    },
    remove(id) {
      try {
        fs.unlinkSync(file(id))
      } catch {
        /* already gone */
      }
    },
    clearAll() {
      ensureDir()
      for (const name of fs.readdirSync(dir)) {
        if (name.endsWith('.json') && name !== 'settings.json') {
          try {
            fs.unlinkSync(path.join(dir, name))
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}

export function emptyUsage(model: string): SessionData['usage'] {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    contextLength: contextLengthFor(model)
  }
}

export function deriveTitle(session: SessionData): void {
  if (session.title && session.title !== 'Новый чат') return
  const firstUser = session.messages.find((message) => message.role === 'user' && message.content)
  if (firstUser?.content) {
    session.title = firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 48)
  }
}
