"use client";

import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col overflow-auto bg-tv-panel p-4 text-xs text-tv-red">
          <div className="mb-2 font-bold uppercase">Orderbook Error</div>
          <div className="whitespace-pre-wrap">{this.state.error.message}</div>
          <div className="mt-4 whitespace-pre-wrap opacity-60">
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
