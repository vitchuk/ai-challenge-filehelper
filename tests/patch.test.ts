import { createTwoFilesPatch } from 'diff'
import { describe, expect, it } from 'vitest'

describe('unified patch generation', () => {
  it('marks added and removed lines', () => {
    const patch = createTwoFilesPatch('a/f.ts', 'b/f.ts', 'const a = 1\n', 'const a = 2\n', '', '')
    expect(patch).toContain('-const a = 1')
    expect(patch).toContain('+const a = 2')
  })

  it('represents a new file as additions', () => {
    const patch = createTwoFilesPatch('a/new.md', 'b/new.md', '', '# Title\n', '', '')
    expect(patch).toContain('+# Title')
    expect(patch).not.toContain('-# Title')
  })
})
