import fs from 'node:fs'
import path from 'node:path'

export class SandboxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SandboxError'
  }
}

/**
 * Resolve the workspace root to its real (symlink-free) absolute path.
 * The root must already exist.
 */
export function normalizeRoot(root: string): string {
  if (!root || !root.trim()) throw new SandboxError('Workspace folder is not selected')
  const abs = path.resolve(root)
  if (!fs.existsSync(abs)) throw new SandboxError(`Workspace folder does not exist: ${root}`)
  return fs.realpathSync.native(abs)
}

export function isAbsolutePathLike(input: string): boolean {
  return path.isAbsolute(input) || /^[a-zA-Z]:[\\/]/.test(input) || input.startsWith('\\\\')
}

/**
 * Resolve a tool-supplied relative path inside the workspace.
 * Throws SandboxError on absolute paths, `..` escapes or symlink escapes.
 */
export function resolveInRoot(realRoot: string, relPath: string): string {
  const raw = (relPath ?? '').trim()
  if (!raw || raw === '.') return realRoot
  if (isAbsolutePathLike(raw)) {
    throw new SandboxError(`Absolute paths are not allowed: ${relPath}`)
  }

  const target = path.resolve(realRoot, raw)
  const rel = path.relative(realRoot, target)
  if (rel === '') return realRoot
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new SandboxError(`Path escapes the workspace: ${relPath}`)
  }

  assertNoSymlinkEscape(realRoot, target)
  return target
}

function withinRoot(realRoot: string, candidate: string): boolean {
  const rel = path.relative(realRoot, candidate)
  if (rel === '') return true
  return !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
}

/**
 * Walk up to the nearest existing ancestor and verify its real path is inside
 * the workspace. This blocks symlinks pointing outside the root, including for
 * files that do not exist yet (we validate the parent directory).
 */
function assertNoSymlinkEscape(realRoot: string, target: string): void {
  let probe = target
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe)
    if (parent === probe) return
    probe = parent
  }
  const real = fs.realpathSync.native(probe)
  if (!withinRoot(realRoot, real)) {
    throw new SandboxError(`Path escapes the workspace via a symlink: ${target}`)
  }
}
