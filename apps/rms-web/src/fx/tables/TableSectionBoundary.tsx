"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { FxTableError } from "./FxTableStates";

type Props = { title: string; children: ReactNode };
type State = { error: Error | null };

export class TableSectionBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rms-fx-tables] section failed", this.props.title, error, info.componentStack);
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <FxTableError
          title={`${this.props.title} unavailable`}
          description={this.state.error.message || "Unexpected table error."}
        />
      );
    }
    return this.props.children;
  }
}
