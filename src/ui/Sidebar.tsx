import { MOD_KEY } from '../lib/format';
import { cycleTheme, theme } from '../lib/theme';
import { getTools } from '../tools/workspace';
import { Icon, Logo } from './Icon';

const THEME_LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' } as const;
const THEME_ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;

export function Sidebar({ active, onOpenPalette }: { active: string; onOpenPalette: () => void }) {
  return (
    <nav class="sidebar" aria-label="Tools">
      <div class="brand">
        <Logo />
        <div>
          Redline
          <small>Text tools</small>
        </div>
      </div>
      <ul class="nav-list">
        {getTools().map((t, i) => (
          <li key={t.id}>
            <a class="nav-link" href={`#/${t.id}`} aria-current={t.id === active ? 'page' : undefined} title={`${t.name} (Alt+${i + 1})`}>
              <Icon name={t.icon} size={18} />
              <span>{t.name}</span>
            </a>
          </li>
        ))}
      </ul>
      <div class="sidebar__foot">
        <button type="button" class="nav-link btn-reset" onClick={onOpenPalette}>
          <Icon name="search" size={18} />
          <span>Search</span>
          <kbd>{MOD_KEY}K</kbd>
        </button>
        <button type="button" class="nav-link btn-reset" onClick={cycleTheme} title="Switch theme">
          <Icon name={THEME_ICON[theme.value]} size={18} />
          <span>{THEME_LABEL[theme.value]}</span>
        </button>
        <p class="sidebar__privacy">Everything runs in your browser. Nothing is uploaded.</p>
      </div>
    </nav>
  );
}
