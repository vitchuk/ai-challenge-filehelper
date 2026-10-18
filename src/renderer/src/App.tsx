import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useStore } from './store'
import { SessionSidebar } from './components/SessionSidebar'
import { MessageList } from './components/MessageList'
import { Composer } from './components/Composer'
import { RightPanel } from './components/RightPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { DiffCard } from './components/DiffCard'

function ApprovalCard(): JSX.Element | null {
  const approval = useStore((state) => state.approval)
  const respond = useStore((state) => state.respond)
  const [applyAll, setApplyAll] = useState(false)

  if (!approval) return null

  return (
    <div className="approval-card">
      <div className="approval-head">
        <span className={`badge badge-${approval.tool}`}>{approval.tool}</span>
        <span className="approval-path">{approval.path}</span>
      </div>
      <div className="approval-diff">
        <DiffCard path={approval.path} before={approval.before} after={approval.after} />
      </div>
      <div className="approval-actions">
        <label className="checkbox">
          <input type="checkbox" checked={applyAll} onChange={(event) => setApplyAll(event.target.checked)} />
          применять всё без подтверждения
        </label>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={() => void respond(false, false)}>
          Отклонить
        </button>
        <button className="btn btn-primary" onClick={() => void respond(true, applyAll)}>
          Применить
        </button>
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  const ready = useStore((state) => state.ready)
  const init = useStore((state) => state.init)
  const active = useStore((state) => state.active)
  const status = useStore((state) => state.status)
  const error = useStore((state) => state.error)
  const pickWorkspace = useStore((state) => state.pickWorkspace)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) {
    return <div className="loading">Загрузка…</div>
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">filehelper</div>
        <div className="workspace">
          <button className="btn btn-ghost" onClick={() => void pickWorkspace()}>
            📁 Папка
          </button>
          <span className="workspace-path" title={active?.workspace ?? ''}>
            {active?.workspace ?? 'папка не выбрана'}
          </span>
        </div>
        <div className="status-pill">
          {status === 'thinking' ? '● работает' : status === 'error' ? '● ошибка' : '● готов'}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="layout">
        <PanelGroup direction="horizontal" autoSaveId="filehelper-layout">
          <Panel defaultSize={18} minSize={12} className="panel-col">
            <SessionSidebar />
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel minSize={30} className="panel-col">
            <main className="chat">
              <MessageList />
              <ApprovalCard />
              <Composer />
            </main>
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel defaultSize={26} minSize={16} className="panel-col">
            <RightPanel />
          </Panel>
        </PanelGroup>
      </div>

      <SettingsPanel />
    </div>
  )
}
