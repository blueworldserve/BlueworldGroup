import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps a failing 3D globe from taking the whole page down; shows the fallback instead. */
export class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[globe] failed to render, showing the static logo instead:", error.message, info.componentStack);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}