import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ProviderId } from '@shared/types'
import { PROVIDERS, PROVIDER_IDS } from './providers'

export interface SecretCodec {
  available: boolean
  encrypt(plain: string): string
  decrypt(encoded: string): string
}

interface StoredSecret {
  enc?: string
  plain?: string
}

interface StoredSettings {
  keys: Partial<Record<ProviderId, StoredSecret>>
  baseURLs: Partial<Record<ProviderId, string>>
  defaultProvider: ProviderId
  defaultModel: string
  clientId: string
}

const DEFAULTS: StoredSettings = {
  keys: {},
  baseURLs: {},
  defaultProvider: 'opencode-go',
  defaultModel: 'glm-5.3',
  clientId: ''
}

export interface SettingsStore {
  getKey(provider: ProviderId): string | null
  setKey(provider: ProviderId, key: string): void
  hasKey(provider: ProviderId): boolean
  getBaseURL(provider: ProviderId): string
  setBaseURL(provider: ProviderId, url: string): void
  getDefaultProvider(): ProviderId
  getDefaultModel(): string
  setDefaults(provider: ProviderId, model: string): void
  getClientId(): string
}

export function createSettingsStore(dir: string, codec: SecretCodec): SettingsStore {
  const file = path.join(dir, 'settings.json')

  let data: StoredSettings = load()

  function load(): StoredSettings {
    try {
      const raw = fs.readFileSync(file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<StoredSettings>
      return {
        keys: parsed.keys ?? {},
        baseURLs: parsed.baseURLs ?? {},
        defaultProvider: parsed.defaultProvider ?? DEFAULTS.defaultProvider,
        defaultModel: parsed.defaultModel ?? DEFAULTS.defaultModel,
        clientId: parsed.clientId ?? randomUUID()
      }
    } catch {
      return { ...DEFAULTS, keys: {}, baseURLs: {}, clientId: randomUUID() }
    }
  }

  function persist(): void {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
  }

  return {
    getKey(provider) {
      const secret = data.keys[provider]
      if (!secret) return null
      if (secret.plain !== undefined) return secret.plain
      if (secret.enc && codec.available) {
        try {
          return codec.decrypt(secret.enc)
        } catch {
          return null
        }
      }
      return null
    },
    setKey(provider, key) {
      if (!key) {
        delete data.keys[provider]
      } else if (codec.available) {
        data.keys[provider] = { enc: codec.encrypt(key) }
      } else {
        data.keys[provider] = { plain: key }
      }
      persist()
    },
    hasKey(provider) {
      const secret = data.keys[provider]
      return Boolean(secret && (secret.enc || secret.plain))
    },
    getBaseURL(provider) {
      return data.baseURLs[provider]?.trim() || PROVIDERS[provider].defaultBaseURL
    },
    setBaseURL(provider, url) {
      const trimmed = url.trim()
      if (trimmed) data.baseURLs[provider] = trimmed
      else delete data.baseURLs[provider]
      persist()
    },
    getDefaultProvider() {
      return PROVIDER_IDS.includes(data.defaultProvider) ? data.defaultProvider : 'opencode-go'
    },
    getDefaultModel() {
      return data.defaultModel || DEFAULTS.defaultModel
    },
    setDefaults(provider, model) {
      data.defaultProvider = provider
      data.defaultModel = model || DEFAULTS.defaultModel
      persist()
    },
    getClientId() {
      return data.clientId
    }
  }
}
