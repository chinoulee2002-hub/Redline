import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Open/close state for a button with a floating panel (a menu or a list of
 * options). Closes on a click outside `root` or on Escape, which also returns
 * focus to the button. Opening focuses the first control in the `.menu` panel.
 */
export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const root = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      root.current?.querySelector<HTMLElement>('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    root.current?.querySelector<HTMLElement>('.menu button, .menu input')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, root };
}
