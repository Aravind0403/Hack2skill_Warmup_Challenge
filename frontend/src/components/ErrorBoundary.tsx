import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    /** Optional label shown in the error UI for debugging context. */
    context?: string;
}

interface State {
    hasError: boolean;
    message: string;
}

/**
 * Catches uncaught React render errors and displays a graceful fallback UI
 * instead of a blank page. Logs the error details to the console for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, message: error.message };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', this.props.context ?? 'App', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, message: '' });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-500/10 border border-red-500/20 rounded-3xl text-center mx-4"
                >
                    <AlertTriangle className="w-10 h-10 text-red-400 mb-4" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-md">
                        {this.state.message || 'An unexpected error occurred. Please try again.'}
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full text-sm transition-colors"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
