import { useMemo, useState } from 'react'
import type { ProviderId } from '@shared/types'
import { useStore } from '../store'
import { ContextRing } from './ContextRing'

export function Composer(): JSX.Element {
  const [text, setText] = useState('')
  const status = useStore((state) => state.status)
  const active = useStore((state) => state.active)
  const settings = useStore((state) => state.settings)
  const send = useStore((state) => state.send)
  const stop = useStore((state) => state.stop)
  const setModel = useStore((state) => state.setModel)

  const busy = status === 'thinking'
  const usage = active?.usage
  const models = useMemo(() => settings?.providers ?? [], [settings])

  async function handleSend(): Promise<void> {
    if (busy || !text.trim()) return
    const value = text
    setText('')
    await send(value)
  }

  return (
    <div className="composer">
      {settings && active && (
        <div className="composer-toolbar">
          <select
            className="model-select"
            value={`${active.provider}|${active.model}`}
            onChange={(event) => {
              const [provider, model] = event.target.value.split('|')
              void setModel(provider as ProviderId, model)
            }}
          >
            {models.map((provider) => (
              <optgroup key={provider.id} label={provider.label}>
                {provider.models.map((model) => (
                  <option key={`${provider.id}|${model.id}`} value={`${provider.id}|${model.id}`}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ContextRing current={usage?.totalTokens ?? 0} max={usage?.contextLength ?? 128000} />
        </div>
      )}

      <div className="composer-input">
        <textarea
          value={text}
          placeholder="Опишите цель — ассистент сам найдёт нужные файлы (Enter — отправить, Shift+Enter — перенос строки)"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        {busy ? (
          <button className="btn btn-danger" onClick={() => void stop()}>
            Стоп
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => void handleSend()}>
            Отправить
          </button>
        )}
      </div>
    </div>
  )
}
