import { useState } from 'react'
import type { ChangeEntry, FileEntry } from '@shared/types'
import { useStore } from '../store'
import { DiffCard } from './DiffCard'

function TreeNode({ entry, depth }: { entry: FileEntry; depth: number }): JSX.Element {
  const expandedChildren = useStore((state) => state.expanded[entry.path])
  const toggleDir = useStore((state) => state.toggleDir)
  const open = Boolean(expandedChildren)

  return (
    <div className="tree-node">
      <div
        className="tree-row"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => entry.isDir && void toggleDir(entry.path)}
      >
        <span className="tree-icon">{entry.isDir ? (open ? '▾' : '▸') : '·'}</span>
        <span className="tree-name">{entry.name}</span>
      </div>
      {entry.isDir &&
        open &&
        expandedChildren?.map((child) => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} />
        ))}
    </div>
  )
}

function FileTree(): JSX.Element {
  const entries = useStore((state) => state.dirEntries)
  const active = useStore((state) => state.active)
  const loadDir = useStore((state) => state.loadDir)

  if (!active?.workspace) {
    return <div className="empty">Папка проекта не выбрана</div>
  }

  return (
    <div className="file-tree">
      <div className="tree-toolbar">
        <span className="tree-root" title={active.workspace}>
          {active.workspace}
        </span>
        <button className="icon-btn" title="Обновить" onClick={() => void loadDir('')}>
          ⟳
        </button>
      </div>
      {entries.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  )
}

function ChangeRow({ change }: { change: ChangeEntry }): JSX.Element {
  const [open, setOpen] = useState(false)
  const revert = useStore((state) => state.revert)
  const apply = useStore((state) => state.apply)

  return (
    <div className={`change-row${change.reverted ? ' change-reverted' : ''}`}>
      <div className="change-head" onClick={() => setOpen((value) => !value)}>
        <span className={`badge badge-${change.tool}`}>{change.tool}</span>
        <span className="change-path">{change.path}</span>
        <span className="change-time">
          {new Date(change.createdAt).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
      {open && <DiffCard path={change.path} before={change.before} after={change.after} />}
      <div className="change-actions">
        {change.reverted && <span className="change-reverted-label">откатано</span>}
        {change.reverted ? (
          <button className="btn btn-primary btn-small" onClick={() => void apply(change.id)}>
            Применить
          </button>
        ) : (
          <button className="btn btn-ghost btn-small" onClick={() => void revert(change.id)}>
            Откатить
          </button>
        )}
      </div>
    </div>
  )
}

const EMPTY_CHANGES: ChangeEntry[] = []

function ChangesJournal(): JSX.Element {
  const changes = useStore((state) => state.active?.changes ?? EMPTY_CHANGES)
  if (!changes.length) return <div className="empty">Изменений пока нет</div>
  return (
    <div className="changes">
      {[...changes].reverse().map((change) => (
        <ChangeRow key={change.id} change={change} />
      ))}
    </div>
  )
}

export function RightPanel(): JSX.Element {
  const [tab, setTab] = useState<'files' | 'changes'>('files')
  const changeCount = useStore((state) => state.active?.changes.length ?? 0)

  return (
    <aside className="right-panel">
      <div className="tabs">
        <button
          className={`tab${tab === 'files' ? ' tab-active' : ''}`}
          onClick={() => setTab('files')}
        >
          Файлы
        </button>
        <button
          className={`tab${tab === 'changes' ? ' tab-active' : ''}`}
          onClick={() => setTab('changes')}
        >
          Изменения{changeCount ? ` (${changeCount})` : ''}
        </button>
      </div>
      <div className="right-body">{tab === 'files' ? <FileTree /> : <ChangesJournal />}</div>
    </aside>
  )
}
