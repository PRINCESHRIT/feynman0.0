import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.name ?? 'unknown'}]:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '16px',
          color: '#ef5350',
          background: '#1a1a2e',
          borderRadius: '8px',
          margin: '8px',
          fontSize: '12px',
        }}>
          <strong>Error in {this.props.name ?? 'component'}:</strong>
          <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', fontSize: '11px' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px',
              padding: '4px 12px',
              background: '#2a3a5c',
              border: 'none',
              borderRadius: '4px',
              color: '#e8e8e8',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
