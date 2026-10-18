import OpenAI from 'openai'
import type { ApiMessage } from '@shared/types'
import type { StreamChat, StreamChatParams, StreamChatResult, ToolCall } from './agent/loop'

export interface ClientOptions {
  apiKey: string
  baseURL: string
  model: string
  defaultHeaders?: Record<string, string>
}

function toApiMessage(message: ApiMessage): Record<string, unknown> {
  const out: Record<string, unknown> = { role: message.role, content: message.content }
  if (message.tool_calls) out.tool_calls = message.tool_calls
  if (message.tool_call_id) out.tool_call_id = message.tool_call_id
  if (message.reasoning_content) out.reasoning_content = message.reasoning_content
  return out
}

function isStreamOptionsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /stream_options|include_usage/i.test(message)
}

export function createStreamChat(options: ClientOptions): StreamChat {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.defaultHeaders
  })

  return async (params: StreamChatParams): Promise<StreamChatResult> => {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: params.messages.map(toApiMessage),
      stream: true,
      stream_options: { include_usage: true }
    }
    if (params.tools.length) {
      body.tools = params.tools
      body.tool_choice = 'auto'
    }

    let stream: AsyncIterable<unknown>
    try {
      stream = (await client.chat.completions.create(
        body as never,
        { signal: params.signal }
      )) as unknown as AsyncIterable<unknown>
    } catch (error) {
      if (!isStreamOptionsError(error)) throw error
      delete body.stream_options
      stream = (await client.chat.completions.create(
        body as never,
        { signal: params.signal }
      )) as unknown as AsyncIterable<unknown>
    }

    let content = ''
    let reasoning = ''
    const toolAccumulator: Record<number, { id: string; name: string; args: string }> = {}
    let usage: StreamChatResult['usage']

    for await (const rawChunk of stream) {
      const chunk = rawChunk as {
        choices?: Array<{
          delta?: {
            content?: string | null
            reasoning_content?: string | null
            reasoning?: string | null
            tool_calls?: Array<{
              index?: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>
          }
        }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }

      const delta = chunk.choices?.[0]?.delta
      if (delta?.content) {
        content += delta.content
        params.onText?.(delta.content)
      }
      const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning
      if (reasoningDelta) {
        reasoning += reasoningDelta
        params.onReasoning?.(reasoningDelta)
      }
      if (delta?.tool_calls) {
        for (const part of delta.tool_calls) {
          const index = part.index ?? 0
          const current = (toolAccumulator[index] ??= { id: '', name: '', args: '' })
          if (part.id) current.id = part.id
          if (part.function?.name) current.name += part.function.name
          if (part.function?.arguments) current.args += part.function.arguments
        }
      }
      if (chunk.usage) {
        usage = {
          prompt: chunk.usage.prompt_tokens ?? 0,
          completion: chunk.usage.completion_tokens ?? 0,
          total: chunk.usage.total_tokens ?? 0
        }
      }
    }

    const toolCalls: ToolCall[] = Object.values(toolAccumulator)
      .filter((call) => call.name)
      .map((call, index) => ({
        id: call.id || `call_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: call.name,
        args: call.args
      }))

    return { content, reasoning, toolCalls, usage }
  }
}
