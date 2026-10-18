import fs from 'node:fs'
import path from 'node:path'
import { resolveInRoot } from './sandbox'
import type { ProposedChange } from './tools/types'

export function applyChange(root: string, change: ProposedChange): void {
  const abs = resolveInRoot(root, change.path)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, change.after, 'utf8')
}
