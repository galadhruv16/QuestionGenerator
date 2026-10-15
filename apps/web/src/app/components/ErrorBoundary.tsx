import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Logo, Icon } from './ui';
import { clearAllSessionCaches } from '../services/session-store';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Root and route-level Error Boundary for GroundQ.
 * Catches runtime React render exceptions, displays a graceful recovery interface,
 * and completely prevents white screen of death scenarios.
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GroundQ ErrorBoundary caught exception]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      clearAllSessionCaches();
    } catch {
      // Ignore storage errors
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    try {
      clearAllSessionCaches();
    } catch {
      // Ignore
    }
    window.location.href = '/app';
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#fbf8fc] text-[#18181b] flex flex-col font-sans">
          {/* Minimal Header */}
          <header className="h-16 px-6 border-b border-black/10 bg-white/80 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Workspace Recovery
              </span>
            </div>
            <button
              onClick={this.handleGoHome}
              className="text-sm text-neutral-600 hover:text-black font-medium transition-colors"
              type="button"
            >
              All Projects
            </button>
          </header>

          {/* Main Error Recovery Container */}
          <main className="flex-1 max-w-2xl mx-auto w-full p-6 sm:p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5 shadow-sm">
              <Icon name="alert" size={32} />
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-2">
              Something went wrong loading this workspace
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 max-w-lg mb-8 leading-relaxed">
              GroundQ encountered an unexpected rendering issue. Your project data and uploaded resources are completely safe.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-lg bg-[#3157d5] hover:bg-[#2544ab] text-white text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
                type="button"
              >
                <Icon name="refresh" size={16} />
                <span>Clear Cache & Reload</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-sm font-medium transition-all"
                type="button"
              >
                Return to Projects
              </button>
            </div>

            {/* Collapsible Diagnostic Details */}
            {this.state.error && (
              <details className="w-full text-left bg-white rounded-xl border border-neutral-200 shadow-sm p-4 overflow-hidden">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-500 hover:text-neutral-800 uppercase tracking-wider select-none">
                  Diagnostic Information
                </summary>
                <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                  <div className="text-xs font-mono text-red-600 bg-red-50 p-2.5 rounded border border-red-100 overflow-x-auto">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-[11px] font-mono text-neutral-600 bg-neutral-50 p-2.5 rounded overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
