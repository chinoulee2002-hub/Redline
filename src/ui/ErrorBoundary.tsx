/**
 * Catches a crash while drawing a tool and shows what happened, with a way
 * out, instead of leaving a blank page.
 */
import { Component, type ComponentChildren } from 'preact';
import { clearStored } from '../lib/storage';
import { Button } from './Button';

interface Props {
  /** The tool inside; its saved data is what "Reset" clears. Omit to clear everything. */
  toolId?: string;
  children: ComponentChildren;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reset = () => {
      clearStored(this.props.toolId ? `${this.props.toolId}.` : '');
      location.reload();
    };
    return (
      <div class="tool">
        <div class="card empty crash" role="alert">
          <b>Something went wrong{this.props.toolId ? ' in this tool' : ''}</b>
          <span>
            Saved text or settings from an earlier version may not fit any more. Resetting clears them.
          </span>
          <code class="crash__detail">{error.message || String(error)}</code>
          <div class="crash__actions">
            <Button variant="primary" onClick={reset}>
              {this.props.toolId ? 'Reset this tool' : 'Reset Redline'}
            </Button>
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }
}
