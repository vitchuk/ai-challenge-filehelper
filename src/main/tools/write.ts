import fs from 'node:fs'
import { resolveInRoot } from '../sandbox'
import type { ToolDef } from './types'

export const writeTool: ToolDef = {
  name: 'write',
  description:
    'Create a new file or fully overwrite an existing file in the workspace. Requires user approval before it is applied.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the workspace root' },
      content: { type: 'string', description: 'The complete new content of the file' }
    },
    required: ['path', 'content']
  },
  async execute(args, ctx) {
    const rel = String(args.path ?? '')
    const file = resolveInRoot(ctx.root, rel)
    const content = String(args.content ?? '')

    let before: string | null = null
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file)
      if (stat.isDirectory()) throw new Error(`${rel} is a directory`)
      before = fs.readFileSync(file, 'utf8')
    }

    return {
      output: `Proposed ${before === null ? 'creation of' : 'overwrite of'} ${rel}`,
      change: { path: rel, before, after: content, tool: 'write' }
    }
  }
}
