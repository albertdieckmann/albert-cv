import { Component, type ReactNode } from "react";

export class PresenceBoundary extends Component<{ children: ReactNode }, { caught: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { caught: false };
  }
  static getDerivedStateFromError() { return { caught: true }; }
  render() { return this.state.caught ? null : this.props.children; }
}
