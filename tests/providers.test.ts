import { describe, expect, it } from 'vitest'
import { contextLengthFor, isChatCompatible } from '../src/main/providers'

describe('isChatCompatible', () => {
  it('keeps models served over chat/completions', () => {
    for (const id of ['glm-5.3', 'glm-5.3-flash', 'kimi-k2.7-code', 'deepseek-v4-pro', 'longcat-2.0', 'hy3']) {
      expect(isChatCompatible(id)).toBe(true)
    }
  })

  it('drops models routed to /responses or /messages', () => {
    for (const id of [
      'grok-4.7',
      'gpt-6-luna',
      'claude-haiku-5-5',
      'gemini-4-argon-contributor',
      'minimax-m3',
      'muse-spark-1.3-contributor',
      'qwen3.8-max',
      'qwen3.8-flash',
      'omen-alpha'
    ]) {
      expect(isChatCompatible(id)).toBe(false)
    }
  })
})

describe('contextLengthFor', () => {
  it('returns larger windows for known model families', () => {
    expect(contextLengthFor('deepseek-v4.1-flash')).toBe(1000000)
    expect(contextLengthFor('kimi-k3')).toBe(256000)
    expect(contextLengthFor('glm-5.3')).toBe(200000)
    expect(contextLengthFor('unknown-model')).toBe(128000)
  })
})
