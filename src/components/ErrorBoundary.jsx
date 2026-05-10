import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <article className="panel empty-state">
          <p className="eyebrow">Erro inesperado</p>
          <h3>Algo deu errado nesta secao.</h3>
          <p className="import-help-text">{this.state.error?.message || 'Erro desconhecido.'}</p>
          <div className="form-actions">
            <button className="primary-button submit-button" type="button" onClick={() => this.setState({ hasError: false, error: null })}>
              Tentar novamente
            </button>
          </div>
        </article>
      )
    }

    return this.props.children
  }
}
