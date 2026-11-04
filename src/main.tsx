import { render } from 'preact';
import { App } from './app';
import './lib/theme';
import { TOOLS } from './tools/registry';
import { registerTools } from './tools/workspace';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

registerTools(TOOLS);
const root = document.getElementById('app')!;
// Remove the "Redline didn't start" message that index.html shows when scripts can't run.
root.textContent = '';
render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  root,
);
