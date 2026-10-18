import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgent, type StreamChat, type StreamChatResult } from '../src/main/agent/loop'
import { normalizeRoot } from '../src/main/sandbox'
import type { ApiMessage } from '../src/shared/types'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'filehelper-agent-'))
  fs.writeFileSync(path.join(root, 'index.ts'), "export const hello = 'world'\n")
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function scripted(responses: StreamChatResult[]): { chat: StreamChat; calls: () => number } {
  let index = 0
  const chat: StreamChat = async () => {
    const response = responses[Math.min(index, responses.length - 1)]
    index += 1
    return response
  }
  return { chat, calls: () => index }
}

function toolCall(name: string, args: Record<string, unknown>, id = 'call_1') {
  return { id, name, args: JSON.stringify(args) }
}

const base = { content: '', reasoning: '', toolCalls: [] as StreamChatResult['toolCalls'] }

describe('runAgent', () => {
  it('returns a plain assistant answer without tools', async () => {
    const { chat } = scripted([{ ...base, content: 'Привет' }])
    const messages: ApiMessage[] = [{ role: 'user', content: 'hi' }]
    await runAgent({
      messages,
      ctx: { root: normalizeRoot(root) },
      streamChat: chat,
      signal: new AbortController().signal,
      requestApproval: async () => true
    })
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Привет' })
  })

  it('executes a read tool call and feeds the result back', async () => {
    const { chat } = scripted([
      { ...base, toolCalls: [toolCall('read', { path: 'index.ts' })] },
      { ...base, content: 'готово' }
    ])
    const messages: ApiMessage[] = [{ role: 'user', content: 'прочитай файл' }]
    await runAgent({
      messages,
      ctx: { root: normalizeRoot(root) },
      streamChat: chat,
      signal: new AbortController().signal,
      requestApproval: async () => true
    })
    const toolMessage = messages.find((message) => message.role === 'tool')
    expect(toolMessage?.content).toContain("world")
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', content: 'готово' })
  })

  it('applies an approved write and records the change', async () => {
    const applied = vi.fn()
    const { chat } = scripted([
      { ...base, toolCalls: [toolCall('write', { path: 'notes.md', content: '# Notes\n' })] },
      { ...base, content: 'создал' }
    ])
    const messages: ApiMessage[] = [{ role: 'user', content: 'create notes' }]
    await runAgent({
      messages,
      ctx: { root: normalizeRoot(root) },
      streamChat: chat,
      signal: new AbortController().signal,
      requestApproval: async () => true,
      onApplied: applied
    })
    expect(fs.readFileSync(path.join(root, 'notes.md'), 'utf8')).toBe('# Notes\n')
    expect(applied).toHaveBeenCalledOnce()
  })

  it('does not write when the user rejects the change', async () => {
    const applied = vi.fn()
    const { chat } = scripted([
      { ...base, toolCalls: [toolCall('write', { path: 'notes.md', content: '# Notes\n' })] },
      { ...base, content: 'ок' }
    ])
    const messages: ApiMessage[] = [{ role: 'user', content: 'create notes' }]
    await runAgent({
      messages,
      ctx: { root: normalizeRoot(root) },
      streamChat: chat,
      signal: new AbortController().signal,
      requestApproval: async () => false,
      onApplied: applied
    })
    expect(fs.existsSync(path.join(root, 'notes.md'))).toBe(false)
    expect(applied).not.toHaveBeenCalled()
    const toolMessage = messages.find((message) => message.role === 'tool')
    expect(toolMessage?.content).toMatch(/rejected/i)
  })

  it('stops after maxSteps even if the model keeps calling tools', async () => {
    const { chat, calls } = scripted([
      { ...base, toolCalls: [toolCall('list', {}, 'call_x')] }
    ])
    const messages: ApiMessage[] = [{ role: 'user', content: 'loop' }]
    await runAgent({
      messages,
      ctx: { root: normalizeRoot(root) },
      streamChat: chat,
      signal: new AbortController().signal,
      requestApproval: async () => true,
      maxSteps: 3
    })
    expect(calls()).toBe(3)
  })
})
