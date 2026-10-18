import type { ApiMessage } from '@shared/types'
import { findTool, toolSchemas } from '../tools'
import type { ProposedChange, ToolOutcome, ToolSchema } from '../tools/types'
import type { ToolContext } from '../tools/types'

export interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

export interface ToolCall {
  id: string
  name: string
  args: string
}

export interface StreamChatParams {
  messages: ApiMessage[]
  tools: ToolSchema[]
  signal: AbortSignal
  onText?: (delta: string) => void
  onReasoning?: (delta: string) => void
}

export interface StreamChatResult {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
  usage?: TokenUsage
}

export type StreamChat = (params: StreamChatParams) => Promise<StreamChatResult>

export interface RunAgentOptions {
  messages: ApiMessage[]
  ctx: ToolContext
  streamChat: StreamChat
  signal: AbortSignal
  maxSteps?: number
  onText?: (delta: string) => void
  onReasoning?: (delta: string) => void
  onMessage?: (message: ApiMessage) => void
  onToolStart?: (call: ToolCall) => void
  onToolEnd?: (call: ToolCall, outcome: ToolOutcome) => void
  onApplied?: (change: ProposedChange) => void
  onUsage?: (usage: TokenUsage) => void
  requestApproval: (change: ProposedChange) => Promise<boolean>
}

export async function runAgent(options: RunAgentOptions): Promise<ApiMessage[]> {
  const {
    messages,
    ctx,
    streamChat,
    signal,
    maxSteps = 25,
    onText,
    onReasoning,
    onMessage,
    onToolStart,
    onToolEnd,
    onApplied,
    onUsage,
    requestApproval
  } = options

  const schemas = toolSchemas()

  for (let step = 0; step < maxSteps; step++) {
    if (signal.aborted) throw new Error('aborted')

    const result = await streamChat({ messages, tools: schemas, signal, onText, onReasoning })
    if (result.usage) onUsage?.(result.usage)

    const assistantMessage: ApiMessage = {
      role: 'assistant',
      content: result.content || null
    }
    if (result.toolCalls.length) {
      assistantMessage.tool_calls = result.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.args }
      }))
    }
    if (result.reasoning) assistantMessage.reasoning_content = result.reasoning

    messages.push(assistantMessage)
    onMessage?.(assistantMessage)

    if (!result.toolCalls.length) break

    for (const call of result.toolCalls) {
      if (signal.aborted) throw new Error('aborted')
      onToolStart?.(call)

      let outcome: ToolOutcome
      try {
        outcome = await executeTool(call, ctx)
      } catch (error) {
        outcome = { output: `Error: ${(error as Error).message}`, isError: true }
      }

      if (outcome.change && !outcome.isError) {
        const change = outcome.change
        const approved = await requestApproval(change)
        if (approved) {
          const { applyChange } = await import('../fsops')
          applyChange(ctx.root, change)
          onApplied?.(change)
          outcome = { ...outcome, output: `${outcome.output}\nChange approved and applied.` }
        } else {
          outcome = {
            output: `${outcome.output}\nThe user rejected this change. It was NOT applied; propose an alternative or stop.`,
            isError: true
          }
        }
      }

      onToolEnd?.(call, outcome)
      const toolMessage: ApiMessage = {
        role: 'tool',
        tool_call_id: call.id,
        content: outcome.output
      }
      messages.push(toolMessage)
      onMessage?.(toolMessage)
    }
  }

  return messages
}

async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolOutcome> {
  const tool = findTool(call.name)
  if (!tool) throw new Error(`Unknown tool: ${call.name}`)

  let args: Record<string, unknown>
  if (call.args && call.args.trim()) {
    try {
      args = JSON.parse(call.args) as Record<string, unknown>
    } catch {
      throw new Error(`Invalid JSON arguments for tool "${call.name}"`)
    }
  } else {
    args = {}
  }

  return tool.execute(args, ctx)
}
