/** Small form controls shared by every tool: toggle chips, segmented control, number stepper. */
import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';

export function Toggle({
  checked,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ComponentChildren;
  title?: string;
}) {
  return (
    <label class={`chip${checked ? ' is-on' : ''}`} title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="chip__box" aria-hidden="true">
        <Icon name="check" size={12} />
      </span>
      {children}
    </label>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          class={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div class="stepper" role="group" aria-label={label}>
      <span class="stepper__label">{label}</span>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(value - 1)} disabled={value <= min}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onInput={(e) => {
          const n = parseInt(e.currentTarget.value, 10);
          if (Number.isFinite(n)) set(n);
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => set(value + 1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}
