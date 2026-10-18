import { describe, expect, it } from 'vitest'
import { buildDiffRows } from '../src/renderer/src/components/gitDiff'

describe('buildDiffRows', () => {
  it('renders a git-style header and marks a new file', () => {
    const rows = buildDiffRows('docs/new.md', null, '# Title\n')
    expect(rows[0]).toMatchObject({ kind: 'meta', text: 'diff --git a/docs/new.md b/docs/new.md' })
    expect(rows.some((r) => r.kind === 'meta' && r.text === 'new file')).toBe(true)
    expect(rows.some((r) => r.kind === 'meta' && r.text === '--- /dev/null')).toBe(true)
    expect(rows.some((r) => r.kind === 'meta' && r.text === '+++ b/docs/new.md')).toBe(true)

    const added = rows.filter((r) => r.kind === 'added')
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ text: '# Title', oldNo: null, newNo: 1 })
  })

  it('numbers removed and added lines on the correct side', () => {
    const rows = buildDiffRows('a.txt', 'a\nb\nc\n', 'a\nB\nc\n')
    expect(rows.find((r) => r.kind === 'removed')).toMatchObject({
      text: 'b',
      oldNo: 2,
      newNo: null
    })
    expect(rows.find((r) => r.kind === 'added')).toMatchObject({
      text: 'B',
      oldNo: null,
      newNo: 2
    })
  })

  it('numbers context lines on both sides', () => {
    const rows = buildDiffRows('a.txt', 'a\nb\nc\n', 'a\nB\nc\n')
    const context = rows.filter((r) => r.kind === 'context')
    expect(context.map((r) => [r.oldNo, r.newNo])).toEqual([
      [1, 1],
      [3, 3]
    ])
  })

  it('emits a unified hunk header', () => {
    const rows = buildDiffRows('a.txt', 'a\nb\nc\n', 'a\nB\nc\n')
    const hunk = rows.find((r) => r.kind === 'hunk')
    expect(hunk?.text).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/)
  })

  it('marks a missing trailing newline', () => {
    const rows = buildDiffRows('a.txt', 'a', 'a\nb')
    expect(rows.some((r) => r.kind === 'meta' && /No newline/.test(r.text))).toBe(true)
  })

  it('returns only header rows when content is unchanged', () => {
    const rows = buildDiffRows('a.txt', 'same\n', 'same\n')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.kind === 'meta')).toBe(true)
  })
})
