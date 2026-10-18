import { useEffect, useState } from 'react'
import type { ProviderId, ProviderView } from '@shared/types'
import { useStore } from '../store'

function ProviderSection({ provider }: { provider: ProviderView }): JSX.Element {
  const saveKey = useStore((state) => state.saveKey)
  const testKey = useStore((state) => state.testKey)
  const setBaseURL = useStore((state) => state.setBaseURL)

  const [key, setKey] = useState('')
  const [base, setBase] = useState(provider.baseURL)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    setBase(provider.baseURL)
  }, [provider.baseURL])

  return (
    <section className="provider-section">
      <h3>
        {provider.label}
        {provider.hasKey && <span className="ok-dot" title="Ключ сохранён" />}
      </h3>

      <label className="field">
        <span>Base URL</span>
        <input
          value={base}
          onChange={(event) => setBase(event.target.value)}
          onBlur={() => void setBaseURL(provider.id, base)}
        />
      </label>

      <label className="field">
        <span>API-ключ</span>
        <input
          type="password"
          value={key}
          placeholder={provider.hasKey ? '•••••••• (сохранён)' : 'вставьте ключ'}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>

      <div className="row">
        <button
          className="btn btn-primary"
          disabled={!key.trim()}
          onClick={async () => {
            await saveKey(provider.id, key.trim())
            setKey('')
            setStatus('Сохранено')
          }}
        >
          Сохранить
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            setStatus('Проверка…')
            const result = await testKey(provider.id, key.trim())
            setStatus(result.ok ? `OK — моделей: ${provider.models.length}` : `Ошибка: ${result.error}`)
          }}
        >
          Проверить
        </button>
        {status && <span className="field-status">{status}</span>}
      </div>

      <div className="models-info">
        Моделей доступно: {provider.models.length}
        {provider.modelsError && <span className="warn"> ({provider.modelsError})</span>}
      </div>
    </section>
  )
}

export function SettingsPanel(): JSX.Element | null {
  const open = useStore((state) => state.settingsOpen)
  const openSettings = useStore((state) => state.openSettings)
  const settings = useStore((state) => state.settings)
  const setDefaults = useStore((state) => state.setDefaults)
  const clearSessions = useStore((state) => state.clearSessions)

  const [provider, setProvider] = useState<ProviderId>('opencode-go')
  const [model, setModel] = useState('')

  useEffect(() => {
    if (settings) {
      setProvider(settings.defaultProvider)
      setModel(settings.defaultModel)
    }
  }, [settings])

  if (!open || !settings) return null

  const providerView = settings.providers.find((item) => item.id === provider)
  const models = providerView?.models ?? []

  return (
    <div className="overlay" onClick={() => openSettings(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Настройки</h2>
          <button className="icon-btn" onClick={() => openSettings(false)}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {settings.providers.map((item) => (
            <ProviderSection key={item.id} provider={item} />
          ))}

          <section className="provider-section">
            <h3>Модель по умолчанию</h3>
            <div className="row">
              <select
                value={provider}
                onChange={(event) => {
                  const next = event.target.value as ProviderId
                  setProvider(next)
                  const first = settings.providers.find((item) => item.id === next)?.models[0]
                  setModel(first?.id ?? '')
                }}
              >
                {settings.providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={() => void setDefaults(provider, model)}
                disabled={!model}
              >
                Сделать по умолчанию
              </button>
            </div>
          </section>

          <section className="provider-section">
            <h3>Данные</h3>
            <p className="hint">
              Сессии и настройки хранятся в папке приложения (%APPDATA%). Ключи шифруются средствами ОС.
            </p>
            <button className="btn btn-danger" onClick={() => void clearSessions()}>
              Удалить все сессии
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
