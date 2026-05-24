'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Jolly ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="pixel-app flex items-center justify-center p-6">
          <div className="pixel-panel max-w-md p-6 text-center">
            <h2 className="pixel-title text-[10px]">
              {this.props.fallbackTitle ?? 'Something broke'}
            </h2>
            <p className="pixel-error">{this.state.message}</p>
            <button type="button" className="pixel-btn mt-6" onClick={this.handleReset}>
              TRY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
