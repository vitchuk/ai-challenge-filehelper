import { structuredPatch } from 'diff'

export type DiffRowKind = 'meta' | 'hunk' | 'added' | 'removed' | 'context'

export interface DiffRow {
  kind: DiffRowKind
  text: string
  oldNo: number | null
  newNo: number | null
}

const EMPTY_ROW: Pick<DiffRow, 'oldNo' | 'newNo'> = { oldNo: null, newNo: null }

export function buildDiffRows(path: string, before: string | null, after: string | null): DiffRow[] {
  const rows: DiffRow[] = []

  rows.push({ kind: 'meta', text: `diff --git a/${path} b/${path}`, ...EMPTY_ROW })
  if (before === null) rows.push({ kind: 'meta', text: 'new file', ...EMPTY_ROW })
  rows.push({
    kind: 'meta',
    text: `--- ${before === null ? '/dev/null' : `a/${path}`}`,
    ...EMPTY_ROW
  })
  rows.push({ kind: 'meta', text: `+++ b/${path}`, ...EMPTY_ROW })

  const patch = structuredPatch(`a/${path}`, `b/${path}`, before ?? '', after ?? '', '', '', {
    context: 3
  })

  for (const hunk of patch.hunks) {
    rows.push({
      kind: 'hunk',
      text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      ...EMPTY_ROW
    })

    let oldNo = hunk.oldStart
    let newNo = hunk.newStart

    for (const line of hunk.lines) {
      const marker = line.charAt(0)
      if (marker === '+') {
        rows.push({ kind: 'added', text: line.slice(1), oldNo: null, newNo: newNo++ })
      } else if (marker === '-') {
        rows.push({ kind: 'removed', text: line.slice(1), oldNo: oldNo++, newNo: null })
      } else if (marker === '\\') {
        rows.push({ kind: 'meta', text: line, ...EMPTY_ROW })
      } else {
        rows.push({ kind: 'context', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
      }
    }
  }

  return rows
}
