import fs from 'node:fs'
import { resolveInRoot } from '../sandbox'
import type { ToolDef } from './types'

export const listTool: ToolDef = {
  name: 'list',
  description: 'List the entries of a directory in the workspace (files and subdirectories).',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path relative to the workspace root' }
    },
    required: []
  },
  async execute(args, ctx) {
    const rel = String(args.path ?? '.')
    const dir = resolveInRoot(ctx.root, rel)
    if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${rel}`)
    const stat = fs.statSync(dir)
    if (!stat.isDirectory()) throw new Error(`${rel} is a file; use read instead`)

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const lines = entries
      .map((entry) => {
        if (entry.isDirectory()) return `${entry.name}/`
        return entry.name
      })
      .sort()

    return { output: lines.length ? lines.join('\n') : '(empty directory)' }
  }
}
