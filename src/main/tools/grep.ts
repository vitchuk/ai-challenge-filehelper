import fs from 'node:fs'
import fg from 'fast-glob'
import { resolveInRoot } from '../sandbox'
import { DEFAULT_IGNORE } from './glob'
import type { ToolDef } from './types'

const MAX_MATCHES = 200
const MAX_FILE_BYTES = 1024 * 1024
const MAX_LINE_LEN = 300

export const grepTool: ToolDef = {
  name: 'grep',
  description:
    'Search file contents by regular expression across the workspace. Returns "path:line: text" matches. Use this to find usages of a component, function or API.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'JavaScript regular expression' },
      glob: { type: 'string', description: 'Glob limiting which files to search (default "**/*")' },
      path: { type: 'string', description: 'Directory to search in (default: workspace root)' },
      ignoreCase: { type: 'boolean', description: 'Case-insensitive search' }
    },
    required: ['pattern']
  },
  async execute(args, ctx) {
    const pattern = String(args.pattern ?? '')
    if (!pattern) throw new Error('pattern is required')

    let regex: RegExp
    try {
      regex = new RegExp(pattern, args.ignoreCase ? 'i' : '')
    } catch (error) {
      throw new Error(`Invalid regular expression: ${(error as Error).message}`)
    }

    const baseDir = resolveInRoot(ctx.root, String(args.path ?? '.'))
    const files = await fg(String(args.glob ?? '**/*'), {
      cwd: baseDir,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      ignore: DEFAULT_IGNORE,
      suppressErrors: true
    })

    const results: string[] = []
    for (const rel of files.sort()) {
      if (results.length >= MAX_MATCHES) break
      const abs = resolveInRoot(baseDir, rel)
      let stat: fs.Stats
      try {
        stat = fs.statSync(abs)
      } catch {
        continue
      }
      if (stat.size > MAX_FILE_BYTES) continue

      let text: string
      try {
        text = fs.readFileSync(abs, 'utf8')
      } catch {
        continue
      }
      if (text.includes('\u0000')) continue

      const lines = text.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= MAX_MATCHES) break
        if (regex.test(lines[i])) {
          const trimmed = lines[i].trim().slice(0, MAX_LINE_LEN)
          results.push(`${rel}:${i + 1}: ${trimmed}`)
        }
      }
    }

    return {
      output: results.length
        ? `${results.join('\n')}${results.length >= MAX_MATCHES ? '\n... (results truncated)' : ''}`
        : 'No matches found.'
    }
  }
}
