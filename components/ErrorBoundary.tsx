import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { Button, Card } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleCopyError = () => {
    if (!this.state.error) return;
    const errorDetails = `
Error: ${this.state.error.message}
Stack: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo?.componentStack || 'N/A'}
User Agent: ${navigator.userAgent}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(err => {
      console.error("Failed to copy error to clipboard", err);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-4 md:p-8 font-sans antialiased selection:bg-indigo-500/30">
          <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-red-600/30 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/30 blur-[120px]" />
          </div>

          <Card className="w-full max-w-2xl bg-[#1e293b]/90 border border-red-500/20 shadow-2xl relative z-10 backdrop-blur-xl">
            <div className="flex flex-col items-center text-center p-2">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 shadow-xl shadow-red-500/5 ring-1 ring-red-500/20 animate-pulse">
                <AlertTriangle size={32} />
              </div>

              <h1 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight mb-2">
                Application Interruption
              </h1>
              <p className="text-gray-400 text-sm max-w-md mb-6 leading-relaxed">
                An unexpected security constraint or runtime exception occurred. We have isolated the issue to prevent data loss.
              </p>

              {this.state.error && (
                <div className="w-full text-left bg-black/40 rounded-xl border border-white/5 p-4 mb-6 font-mono text-xs overflow-x-auto max-h-60 thin-scrollbar">
                  <div className="text-red-400 font-bold mb-1">
                    [Error]: {this.state.error.message || "Unknown error"}
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-gray-500 whitespace-pre-wrap mt-2 select-text text-[10px] leading-relaxed">
                      {this.state.error.stack}
                    </pre>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-gray-600 whitespace-pre-wrap mt-2 select-text text-[10px] leading-relaxed border-t border-white/5 pt-2">
                      Component Tree:
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Button 
                  onClick={this.handleCopyError}
                  variant="outline"
                  className="px-6 py-2.5 bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-indigo-400 hover:bg-white/10"
                >
                  {this.state.copied ? (
                    <>
                      <Check size={14} className="text-green-400" /> Copied Details
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Error Details
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => window.location.reload()}
                  variant="primary"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20"
                >
                  <RefreshCw size={14} /> Refresh Application
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
