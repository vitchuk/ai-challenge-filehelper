import fg from 'fast-glob'
import { resolveInRoot } from '../sandbox'
import type { ToolDef } from './types'

const MAX_RESULTS = 300

export const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/out/**',
  '**/dist/**',
  '**/release/**',
  '**/.next/**',
  '**/coverage/**'
]

export const globTool: ToolDef = {
  name: 'glob',
  description:
    'Find files by glob pattern (e.g. "src/**/*.ts", "**/*.md"). Returns paths relative to the workspace root.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, relative to the workspace root' },
      path: { type: 'string', description: 'Directory to search in (default: workspace root)' }
    },
    required: ['pattern']
  },
  async execute(args, ctx) {
    const pattern = String(args.pattern ?? '').trim()
    if (!pattern) throw new Error('pattern is required')
    const baseDir = resolveInRoot(ctx.root, String(args.path ?? '.'))

    const matches = await fg(pattern, {
      cwd: baseDir,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      ignore: DEFAULT_IGNORE,
      suppressErrors: true
    })

    const sorted = matches.sort()
    const shown = sorted.slice(0, MAX_RESULTS)
    const suffix =
      sorted.length > shown.length ? `\n... (${sorted.length - shown.length} more matches)` : ''
    return {
      output: shown.length ? `${shown.join('\n')}${suffix}` : 'No files matched the pattern.'
    }
  }
}
