import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let readable = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        readable = parsed.error;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, errorMessage: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#0D121D] border border-white/15 p-8 text-center">
            <h1 className="text-xl font-bold text-white mb-2">
              දෝෂයක් හඳුනාගන්නා ලදී / Application Error
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {this.state.errorMessage || 'An unexpected error occurred. Please reload the page.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-sm transition-colors"
            >
              නැවත පූරණය කරන්න / Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
