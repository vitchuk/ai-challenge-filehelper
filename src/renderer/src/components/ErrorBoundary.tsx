import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="crash">
          <h2>Что-то пошло не так</h2>
          <pre>{this.state.error.message}</pre>
          <div className="row">
            <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              Перезагрузить интерфейс
            </button>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              Обновить окно
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
