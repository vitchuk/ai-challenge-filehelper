import { useMemo, useState } from 'react'
import type { ApiMessage, ApiToolCall } from '@shared/types'
import { useStore } from '../store'

function toolSummary(name: string, rawArgs: string): string {
  try {
    const args = JSON.parse(rawArgs || '{}') as Record<string, unknown>
    switch (name) {
      case 'read':
      case 'list':
        return String(args.path ?? '.')
      case 'glob':
        return `${String(args.pattern ?? '')}${args.path ? ` (${String(args.path)})` : ''}`
      case 'grep':
        return `${String(args.pattern ?? '')}${args.glob ? ` — ${String(args.glob)}` : ''}`
      case 'write':
        return `${String(args.path ?? '')} (${String(args.content ?? '').length} симв.)`
      case 'edit':
        return String(args.path ?? '')
      default:
        return rawArgs.slice(0, 100)
    }
  } catch {
    return rawArgs.slice(0, 100)
  }
}

function ReasoningBlock({ text }: { text: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="reasoning">
      <button className="reasoning-toggle" onClick={() => setOpen((value) => !value)}>
        {open ? '▾' : '▸'} Размышления
      </button>
      {open && <pre className="reasoning-body">{text}</pre>}
    </div>
  )
}

function ToolCard({ call, result }: { call: ApiToolCall; result?: ApiMessage }): JSX.Element {
  const [open, setOpen] = useState(false)
  const isError = result?.content?.startsWith('Error') || result?.content?.includes('rejected')
  return (
    <div className={`tool-card${isError ? ' tool-card-error' : ''}`}>
      <button className="tool-head" onClick={() => setOpen((value) => !value)}>
        <span className="tool-name">{call.function.name}</span>
        <span className="tool-summary">{toolSummary(call.function.name, call.function.arguments)}</span>
        <span className="tool-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="tool-body">
          <div className="tool-section">
            <div className="tool-label">Аргументы</div>
            <pre>{prettyJson(call.function.arguments)}</pre>
          </div>
          {result && (
            <div className="tool-section">
              <div className="tool-label">Результат</div>
              <pre>{result.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw || '{}'), null, 2)
  } catch {
    return raw
  }
}

function AssistantMessage({
  message,
  toolResults
}: {
  message: ApiMessage
  toolResults: Map<string, ApiMessage>
}): JSX.Element {
  return (
    <div className="message message-assistant">
      {message.reasoning_content && <ReasoningBlock text={message.reasoning_content} />}
      {message.content && <div className="message-content">{message.content}</div>}
      {message.tool_calls?.map((call) => (
        <ToolCard key={call.id} call={call} result={toolResults.get(call.id)} />
      ))}
    </div>
  )
}

const EMPTY_MESSAGES: ApiMessage[] = []

export function MessageList(): JSX.Element {
  const messages = useStore((state) => state.active?.messages ?? EMPTY_MESSAGES)
  const live = useStore((state) => state.live)
  const running = useStore((state) => state.running)

  const toolResults = useMemo(() => {
    const map = new Map<string, ApiMessage>()
    for (const message of messages) {
      if (message.role === 'tool' && message.tool_call_id) map.set(message.tool_call_id, message)
    }
    return map
  }, [messages])

  return (
    <div className="messages">
      {messages.map((message, index) => {
        if (message.role === 'tool') return null
        if (message.role === 'user') {
          return (
            <div key={index} className="message message-user">
              <div className="message-content">{message.content}</div>
            </div>
          )
        }
        return <AssistantMessage key={index} message={message} toolResults={toolResults} />
      })}

      {(live.text || live.reasoning) && (
        <div className="message message-assistant">
          {live.reasoning && <ReasoningBlock text={live.reasoning} />}
          {live.text && <div className="message-content">{live.text}</div>}
        </div>
      )}

      {running.map((tool) => (
        <div key={tool.id} className="tool-card tool-running">
          <div className="tool-head">
            <span className="spinner" />
            <span className="tool-name">{tool.name}</span>
            <span className="tool-summary">{toolSummary(tool.name, tool.args)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
