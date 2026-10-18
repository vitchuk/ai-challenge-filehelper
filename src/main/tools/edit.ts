import fs from 'node:fs'
import { resolveInRoot } from '../sandbox'
import type { ToolDef } from './types'

export const editTool: ToolDef = {
  name: 'edit',
  description:
    'Edit an existing file by replacing an exact substring. oldString must occur exactly once unless replaceAll is true. Requires user approval before it is applied.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the workspace root' },
      oldString: { type: 'string', description: 'Exact text to replace (must be unique)' },
      newString: { type: 'string', description: 'Replacement text (may be empty to delete)' },
      replaceAll: {
        type: 'boolean',
        description: 'Replace every occurrence instead of requiring a unique match'
      }
    },
    required: ['path', 'oldString', 'newString']
  },
  async execute(args, ctx) {
    const rel = String(args.path ?? '')
    const file = resolveInRoot(ctx.root, rel)
    if (!fs.existsSync(file)) throw new Error(`File not found: ${rel} (use write to create it)`)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) throw new Error(`${rel} is a directory`)

    const before = fs.readFileSync(file, 'utf8')
    const oldString = String(args.oldString ?? '')
    const newString = String(args.newString ?? '')
    const replaceAll = Boolean(args.replaceAll)

    if (!oldString) throw new Error('oldString must not be empty')

    const occurrences = before.split(oldString).length - 1
    if (occurrences === 0) throw new Error('oldString was not found in the file')
    if (occurrences > 1 && !replaceAll) {
      throw new Error(
        `oldString matches ${occurrences} places; add more context to make it unique or set replaceAll=true`
      )
    }

    const after = replaceAll
      ? before.split(oldString).join(newString)
      : before.replace(oldString, newString)

    return {
      output: `Proposed edit of ${rel} (${replaceAll ? occurrences : 1} replacement(s))`,
      change: { path: rel, before, after, tool: 'edit' }
    }
  }
}
