import { render } from 'preact';
import { App } from './app';
import './lib/theme';
import { TOOLS } from './tools/registry';
import { registerTools } from './tools/workspace';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

registerTools(TOOLS);
render(<App />, document.getElementById('app')!);
