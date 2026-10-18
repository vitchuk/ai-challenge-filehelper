export type ProviderId = 'opencode-go' | 'deepseek'

export interface ModelInfo {
  id: string
  label: string
  provider: ProviderId
  contextLength: number
}

export interface ProviderView {
  id: ProviderId
  label: string
  baseURL: string
  hasKey: boolean
  models: ModelInfo[]
  modelsError?: string
}

export interface SettingsView {
  providers: ProviderView[]
  defaultProvider: ProviderId
  defaultModel: string
}

export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  contextLength: number
}

export interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
  reasoning_content?: string
}

export interface ChangeEntry {
  id: string
  path: string
  tool: 'write' | 'edit'
  before: string | null
  after: string
  createdAt: number
  reverted?: boolean
}

export interface SessionSummary {
  id: string
  title: string
  workspace: string | null
  provider: ProviderId
  model: string
  createdAt: number
  updatedAt: number
}

export interface SessionData extends SessionSummary {
  messages: ApiMessage[]
  changes: ChangeEntry[]
  usage: Usage
}

export interface ApprovalRequest {
  id: string
  sessionId: string
  path: string
  tool: 'write' | 'edit'
  before: string | null
  after: string
}

export type AgentStatus = 'idle' | 'thinking' | 'aborted' | 'error'

export type AgentEvent =
  | { type: 'text'; sessionId: string; delta: string }
  | { type: 'reasoning'; sessionId: string; delta: string }
  | { type: 'message'; sessionId: string; message: ApiMessage }
  | { type: 'tool-start'; sessionId: string; id: string; name: string; args: string }
  | {
      type: 'tool-end'
      sessionId: string
      id: string
      name: string
      output: string
      isError?: boolean
    }
  | { type: 'approval'; sessionId: string; request: ApprovalRequest }
  | { type: 'change'; sessionId: string; change: ChangeEntry }
  | { type: 'usage'; sessionId: string; usage: Usage }
  | { type: 'session'; sessionId: string; session: SessionData }
  | { type: 'status'; sessionId: string; status: AgentStatus; error?: string }
  | { type: 'fs-refresh' }

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
}
