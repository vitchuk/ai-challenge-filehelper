import type { ModelInfo, ProviderId } from '@shared/types'

export interface ProviderDef {
  id: ProviderId
  label: string
  defaultBaseURL: string
  fallbackModels: string[]
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  'opencode-go': {
    id: 'opencode-go',
    label: 'OpenCode Go',
    defaultBaseURL: 'https://opencode.ai/zen/go/v1',
    fallbackModels: [
      'glm-5.3',
      'glm-5.3-flash',
      'glm-5.2',
      'kimi-k3',
      'kimi-k2.7-code',
      'deepseek-v4-pro',
      'deepseek-v4.1-flash',
      'longcat-2.0',
      'hy3'
    ]
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com',
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner']
  }
}

export const PROVIDER_IDS: ProviderId[] = ['opencode-go', 'deepseek']

export const CLIENT_ID = 'ai-challenge-filehelper'
export const CLIENT_USER_AGENT = `${CLIENT_ID}/0.1.0`

/**
 * OpenCode Go rejects requests without a client identity: a real User-Agent and a
 * stable per-conversation `x-opencode-session` header (used for routing and prompt
 * caching). See https://opencode.ai/docs/go#where-can-i-use-it.
 */
export function clientHeaders(provider: ProviderId, sessionId: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': CLIENT_USER_AGENT }
  if (provider === 'opencode-go') {
    headers['x-opencode-session'] = sessionId
    headers['x-opencode-client'] = CLIENT_ID
  }
  return headers
}

// Models that are not served over the OpenAI-compatible /chat/completions route.
// Grok/GPT/Muse/omen use /responses, Claude/Gemini/MiniMax/Qwen use /messages.
const EXCLUDED_MODEL = /^(grok|gpt|claude|gemini|minimax|muse|qwen|omen|o[0-9])/i

const CONTEXT_TABLE: Array<[RegExp, number]> = [
  [/^deepseek-v4/i, 1000000],
  [/^deepseek-(chat|reasoner|flash)/i, 128000],
  [/^glm-/i, 200000],
  [/^kimi-/i, 256000],
  [/^mimo-/i, 128000],
  [/^longcat-/i, 128000],
  [/^step-/i, 128000]
]

const DEFAULT_CONTEXT = 128000

export function contextLengthFor(model: string): number {
  for (const [pattern, length] of CONTEXT_TABLE) {
    if (pattern.test(model)) return length
  }
  return DEFAULT_CONTEXT
}

export function isChatCompatible(model: string): boolean {
  return !EXCLUDED_MODEL.test(model)
}

export function fallbackModels(provider: ProviderId): ModelInfo[] {
  return PROVIDERS[provider].fallbackModels.map((id) => ({
    id,
    label: id,
    provider,
    contextLength: contextLengthFor(id)
  }))
}

interface ModelsResponse {
  data?: Array<{ id?: string; context_length?: number; context_window?: number; max_context_length?: number }>
  models?: Array<{ id?: string; name?: string }>
}

export interface FetchModelsResult {
  models: ModelInfo[]
  error?: string
}

export async function fetchModels(
  provider: ProviderId,
  baseURL: string,
  apiKey: string,
  sessionId = 'models'
): Promise<FetchModelsResult> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, ...clientHeaders(provider, sessionId) },
      signal: AbortSignal.timeout(20000)
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        models: fallbackModels(provider),
        error: `HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`
      }
    }

    const json = (await response.json()) as ModelsResponse
    const raw = json.data ?? json.models ?? []
    const models: ModelInfo[] = []
    for (const entry of raw) {
      const id = entry.id ?? ('name' in entry ? entry.name : undefined)
      if (!id || !isChatCompatible(id)) continue
      const lengths = entry as Record<string, unknown>
      const declared =
        (lengths.context_length as number | undefined) ??
        (lengths.context_window as number | undefined) ??
        (lengths.max_context_length as number | undefined)
      models.push({
        id,
        label: id,
        provider,
        contextLength: declared && declared > 0 ? declared : contextLengthFor(id)
      })
    }

    models.sort((a, b) => a.id.localeCompare(b.id))

    if (!models.length) {
      return { models: fallbackModels(provider), error: 'Provider returned no chat-compatible models' }
    }
    return { models }
  } catch (error) {
    return { models: fallbackModels(provider), error: (error as Error).message }
  }
}
