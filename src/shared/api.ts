import type {
  AgentEvent,
  FileEntry,
  ModelInfo,
  ProviderId,
  SessionData,
  SessionSummary,
  SettingsView
} from './types'

export interface TestKeyResult {
  ok: boolean
  error?: string
  models: ModelInfo[]
}

export interface FileHelperApi {
  getSettings(): Promise<SettingsView>
  saveKey(provider: ProviderId, key: string): Promise<SettingsView>
  testKey(provider: ProviderId, key: string): Promise<TestKeyResult>
  setBaseURL(provider: ProviderId, url: string): Promise<SettingsView>
  setDefaults(provider: ProviderId, model: string): Promise<SettingsView>

  pickWorkspace(): Promise<string | null>
  setWorkspace(sessionId: string, dir: string | null): Promise<SessionData>

  listSessions(): Promise<SessionSummary[]>
  createSession(provider: ProviderId, model: string): Promise<SessionData>
  getSession(id: string): Promise<SessionData | null>
  setSessionModel(sessionId: string, provider: ProviderId, model: string): Promise<SessionData>
  deleteSession(id: string): Promise<SessionSummary[]>
  clearSessions(): Promise<SessionSummary[]>

  sendMessage(sessionId: string, text: string): Promise<void>
  abort(sessionId: string): Promise<void>
  respondApproval(requestId: string, approved: boolean, applyAll: boolean): Promise<void>

  revertChange(sessionId: string, changeId: string): Promise<SessionData>
  applyChange(sessionId: string, changeId: string): Promise<SessionData>

  readDir(sessionId: string, relPath: string): Promise<FileEntry[]>

  onEvent(cb: (event: AgentEvent) => void): () => void
}
