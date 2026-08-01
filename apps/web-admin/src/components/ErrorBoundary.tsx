import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-xl border border-red-500/30 bg-slate-900 p-6 text-red-400">
            <h2 className="text-lg font-semibold">Ошибка интерфейса</h2>
            <p className="mt-2 text-sm text-slate-400">
              Попробуйте обновить страницу. Если ошибка повторяется, обратитесь в
              поддержку.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              Обновить страницу
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
