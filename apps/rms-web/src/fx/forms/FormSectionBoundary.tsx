"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { FxFormError } from "./FxFormStates";

type Props = { title: string; children: ReactNode };
type State = { error: Error | null };

export class FormSectionBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rms-fx-forms] section failed", this.props.title, error, info.componentStack);
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <FxFormError
          title={`${this.props.title} unavailable`}
          description={this.state.error.message || "Unexpected form error."}
        />
      );
    }
    return this.props.children;
  }
}
