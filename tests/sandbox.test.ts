import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SandboxError, normalizeRoot, resolveInRoot } from '../src/main/sandbox'

let root: string
let outside: string

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'filehelper-sandbox-'))
  root = path.join(base, 'workspace')
  outside = path.join(base, 'outside')
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.mkdirSync(outside, { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const x = 1\n')
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'top secret\n')
})

afterAll(() => {
  fs.rmSync(path.dirname(root), { recursive: true, force: true })
})

describe('normalizeRoot', () => {
  it('resolves an existing directory to a real path', () => {
    expect(fs.existsSync(normalizeRoot(root))).toBe(true)
  })

  it('rejects empty roots', () => {
    expect(() => normalizeRoot('')).toThrow(SandboxError)
  })
})

describe('resolveInRoot', () => {
  it('resolves nested relative paths inside the workspace', () => {
    const realRoot = normalizeRoot(root)
    const resolved = resolveInRoot(realRoot, 'src/index.ts')
    expect(resolved).toBe(path.join(realRoot, 'src', 'index.ts'))
  })

  it('allows a not-yet-existing file inside the workspace', () => {
    const realRoot = normalizeRoot(root)
    expect(() => resolveInRoot(realRoot, 'src/new-file.md')).not.toThrow()
  })

  it('rejects absolute paths', () => {
    const realRoot = normalizeRoot(root)
    expect(() => resolveInRoot(realRoot, path.join(outside, 'secret.txt'))).toThrow(SandboxError)
  })

  it('rejects parent traversal', () => {
    const realRoot = normalizeRoot(root)
    expect(() => resolveInRoot(realRoot, '../outside/secret.txt')).toThrow(SandboxError)
  })

  it('rejects deep parent traversal', () => {
    const realRoot = normalizeRoot(root)
    expect(() => resolveInRoot(realRoot, 'src/../../outside/secret.txt')).toThrow(SandboxError)
  })

  it('rejects symlink escapes when the platform allows creating symlinks', () => {
    const realRoot = normalizeRoot(root)
    const link = path.join(root, 'escape')
    try {
      fs.symlinkSync(outside, link, 'dir')
    } catch {
      return // creating symlinks may require elevated privileges on Windows
    }
    expect(() => resolveInRoot(realRoot, 'escape/secret.txt')).toThrow(SandboxError)
  })
})
