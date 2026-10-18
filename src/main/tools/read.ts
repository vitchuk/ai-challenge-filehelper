import fs from 'node:fs'
import { resolveInRoot } from '../sandbox'
import type { ToolDef } from './types'

const MAX_LINES = 1500

export const readTool: ToolDef = {
  name: 'read',
  description:
    'Read a text file from the workspace. Returns the content with 1-based line numbers. Use offset/limit to page through large files.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the workspace root' },
      offset: { type: 'integer', description: 'First line to read (1-based, default 1)' },
      limit: { type: 'integer', description: 'Maximum number of lines to read (default 1500)' }
    },
    required: ['path']
  },
  async execute(args, ctx) {
    const rel = String(args.path ?? '')
    const file = resolveInRoot(ctx.root, rel)
    if (!fs.existsSync(file)) throw new Error(`File not found: ${rel}`)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) throw new Error(`${rel} is a directory; use the list tool instead`)
    if (stat.size > 5 * 1024 * 1024) throw new Error(`File is too large to read (${stat.size} bytes)`)

    const text = fs.readFileSync(file, 'utf8')
    if (text.includes('\u0000')) throw new Error(`${rel} looks like a binary file`)

    const lines = text.split(/\r?\n/)
    const offset = Math.max(1, Number(args.offset ?? 1) || 1)
    const limit = Math.min(MAX_LINES, Math.max(1, Number(args.limit ?? MAX_LINES) || MAX_LINES))
    const slice = lines.slice(offset - 1, offset - 1 + limit)
    const numbered = slice.map((line, index) => `${offset + index}: ${line}`).join('\n')
    const truncated = offset - 1 + slice.length < lines.length

    return {
      output: truncated
        ? `${numbered}\n... (truncated; file has ${lines.length} lines total)`
        : numbered
    }
  }
}
