import { useMemo } from 'react'
import { buildDiffRows, type DiffRowKind } from './gitDiff'

interface Props {
  path: string
  before: string | null
  after: string | null
}

const MARKER: Record<DiffRowKind, string> = {
  meta: '',
  hunk: '',
  added: '+',
  removed: '-',
  context: ' '
}

export function DiffCard({ path, before, after }: Props): JSX.Element {
  const rows = useMemo(() => buildDiffRows(path, before, after), [path, before, after])

  return (
    <div className="git-diff">
      {rows.map((row, index) => {
        if (row.kind === 'meta' || row.kind === 'hunk') {
          return (
            <div key={index} className={`diff-row diff-${row.kind}`}>
              <span className="diff-text">{row.text}</span>
            </div>
          )
        }
        return (
          <div key={index} className={`diff-row diff-${row.kind}`}>
            <span className="diff-no diff-no-old">{row.oldNo ?? ''}</span>
            <span className="diff-no diff-no-new">{row.newNo ?? ''}</span>
            <span className="diff-marker">{MARKER[row.kind]}</span>
            <span className="diff-text">{row.text.length ? row.text : ' '}</span>
          </div>
        )
      })}
    </div>
  )
}
