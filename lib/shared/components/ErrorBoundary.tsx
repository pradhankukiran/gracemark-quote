// lib/shared/components/ErrorBoundary.tsx
"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  showHomeButton?: boolean
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'An unexpected error occurred while loading this page. Please try refreshing or go back to the home page.',
        showHomeButton = true
      } = this.props

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
          <div className="container mx-auto px-6 py-8 max-w-4xl">
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    {fallbackTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {fallbackMessage}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={this.handleRetry}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                    
                    {showHomeButton && (
                      <Button
                        onClick={this.handleGoHome}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Home className="h-4 w-4" />
                        Go Home
                      </Button>
                    )}
                  </div>

                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="text-left">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                        Error Details (Development)
                      </summary>
                      <div className="mt-2 p-3 bg-slate-50 rounded text-xs font-mono text-slate-700 overflow-auto max-h-40">
                        <div className="font-semibold text-red-600 mb-2">
                          {this.state.error.name}: {this.state.error.message}
                        </div>
                        <pre className="whitespace-pre-wrap text-xs">
                          {this.state.error.stack}
                        </pre>
                        {this.state.errorInfo?.componentStack && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="font-semibold mb-1">Component Stack:</div>
                            <pre className="whitespace-pre-wrap text-xs">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper component for easier usage with hooks
export const ErrorBoundaryWrapper: React.FC<ErrorBoundaryProps> = (props) => {
  return <ErrorBoundary {...props} />
}