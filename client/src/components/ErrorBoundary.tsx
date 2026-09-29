import { Component, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="page-shell"><section className="directory-state" role="alert"><h1>We couldn’t display this page.</h1><p>Please reload to try again. If you were saving changes, check the record before submitting again.</p><button className="primary-button" onClick={() => window.location.reload()}>Reload application</button></section></main>;
    return this.props.children;
  }
}
