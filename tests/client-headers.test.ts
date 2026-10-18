import { describe, expect, it } from 'vitest'
import { CLIENT_ID, CLIENT_USER_AGENT, clientHeaders } from '../src/main/providers'

describe('clientHeaders', () => {
  it('sends a stable per-conversation session header for OpenCode Go', () => {
    const headers = clientHeaders('opencode-go', 'session-123')
    expect(headers['x-opencode-session']).toBe('session-123')
    expect(headers['x-opencode-client']).toBe(CLIENT_ID)
  })

  it('uses a real client User-Agent rather than a generic SDK name', () => {
    const headers = clientHeaders('opencode-go', 'session-123')
    expect(headers['User-Agent']).toBe(CLIENT_USER_AGENT)
    expect(headers['User-Agent'].toLowerCase()).not.toContain('openai')
  })

  it('does not send the OpenCode-specific header to DeepSeek', () => {
    const headers = clientHeaders('deepseek', 'session-123')
    expect(headers['x-opencode-session']).toBeUndefined()
    expect(headers['User-Agent']).toBe(CLIENT_USER_AGENT)
  })
})
