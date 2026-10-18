import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { normalizeRoot, resolveInRoot } from '../src/main/sandbox'
import { editTool } from '../src/main/tools/edit'
import { writeTool } from '../src/main/tools/write'
import type { ToolContext } from '../src/main/tools/types'

let root: string
let ctx: ToolContext

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'filehelper-edit-'))
  ctx = { root: normalizeRoot(root) }
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('edit tool', () => {
  it('produces a change for a unique match without touching the file', async () => {
    fs.writeFileSync(path.join(root, 'a.txt'), 'hello world\n')
    const outcome = await editTool.execute(
      { path: 'a.txt', oldString: 'world', newString: 'there' },
      ctx
    )
    expect(outcome.change?.after).toBe('hello there\n')
    expect(fs.readFileSync(path.join(root, 'a.txt'), 'utf8')).toBe('hello world\n')
  })

  it('fails when oldString is not found', async () => {
    fs.writeFileSync(path.join(root, 'b.txt'), 'abc\n')
    await expect(
      editTool.execute({ path: 'b.txt', oldString: 'zzz', newString: 'x' }, ctx)
    ).rejects.toThrow(/not found/)
  })

  it('fails on ambiguous matches without replaceAll', async () => {
    fs.writeFileSync(path.join(root, 'c.txt'), 'x x x\n')
    await expect(
      editTool.execute({ path: 'c.txt', oldString: 'x', newString: 'y' }, ctx)
    ).rejects.toThrow(/matches 3 places/)
  })

  it('replaces all occurrences with replaceAll', async () => {
    fs.writeFileSync(path.join(root, 'd.txt'), 'x x x\n')
    const outcome = await editTool.execute(
      { path: 'd.txt', oldString: 'x', newString: 'y', replaceAll: true },
      ctx
    )
    expect(outcome.change?.after).toBe('y y y\n')
  })

  it('refuses paths outside the workspace', async () => {
    await expect(
      editTool.execute({ path: '../../etc/passwd', oldString: 'a', newString: 'b' }, ctx)
    ).rejects.toThrow()
  })
})

describe('write tool', () => {
  it('marks new files with a null before state', async () => {
    const outcome = await writeTool.execute({ path: 'docs/new.md', content: '# Hi\n' }, ctx)
    expect(outcome.change?.before).toBeNull()
    expect(outcome.change?.after).toBe('# Hi\n')
  })

  it('captures previous content for overwrites', async () => {
    fs.writeFileSync(path.join(root, 'e.txt'), 'old\n')
    const outcome = await writeTool.execute({ path: 'e.txt', content: 'new\n' }, ctx)
    expect(outcome.change?.before).toBe('old\n')
    expect(outcome.change?.after).toBe('new\n')
  })
})

describe('sandbox-aware resolution helper', () => {
  it('keeps resolved paths inside the root', () => {
    expect(resolveInRoot(ctx.root, 'docs/new.md').startsWith(ctx.root)).toBe(true)
  })
})
