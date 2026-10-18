import { useStore } from '../store'

export function SessionSidebar(): JSX.Element {
  const sessions = useStore((state) => state.sessions)
  const activeId = useStore((state) => state.active?.id ?? null)
  const newSession = useStore((state) => state.newSession)
  const selectSession = useStore((state) => state.selectSession)
  const deleteSession = useStore((state) => state.deleteSession)
  const clearSessions = useStore((state) => state.clearSessions)
  const openSettings = useStore((state) => state.openSettings)

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="btn btn-primary sidebar-new" onClick={() => void newSession()}>
          + Новый чат
        </button>
      </div>

      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item${session.id === activeId ? ' session-item-active' : ''}`}
            onClick={() => void selectSession(session.id)}
          >
            <div className="session-text">
              <div className="session-title">{session.title}</div>
              <div className="session-sub">{session.model}</div>
            </div>
            <button
              className="icon-btn"
              title="Удалить сессию"
              onClick={(event) => {
                event.stopPropagation()
                void deleteSession(session.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <button className="btn btn-ghost" onClick={() => void clearSessions()}>
          Очистить все
        </button>
        <button className="btn btn-ghost" onClick={() => openSettings(true)}>
          ⚙ Настройки
        </button>
      </div>
    </aside>
  )
}
