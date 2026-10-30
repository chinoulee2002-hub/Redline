/**
 * Text panes: the bordered editor cards every tool is built from.
 * `TextPane` edits a signal; `OutputPane` shows a computed result.
 */
import type { Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { copyText } from '../lib/clipboard';
import { downloadText } from '../lib/download';
import { ACCEPTED_FILES, readFileAsText } from '../lib/files';
import { plural } from '../lib/format';
import { showToast } from '../lib/toast';
import { countChars, countLines, countWords } from '../core/tokenize';
import type { SentText } from '../tools/types';
import { Button } from './Button';
import { SendToMenu } from './SendToMenu';

type Font = 'ui' | 'doc' | 'mono';

function PaneFrame({
  title,
  badge,
  actions,
  footer,
  children,
  class: cls,
  dropActive,
  ...dropHandlers
}: {
  title: string;
  badge?: string;
  actions?: ComponentChildren;
  footer?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  dropActive?: boolean;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}) {
  return (
    <section class={`pane${dropActive ? ' is-drop' : ''}${cls ? ' ' + cls : ''}`} {...dropHandlers}>
      <header class="pane__head">
        <h2 class="pane__title">
          {badge && <span class="pane__badge">{badge}</span>}
          {title}
        </h2>
        <div class="pane__actions">{actions}</div>
      </header>
      <div class="pane__body">{children}</div>
      {footer && <footer class="pane__foot">{footer}</footer>}
    </section>
  );
}

export function TextCounts({ text }: { text: string }) {
  return (
    <span class="counts">
      {plural(countWords(text), 'word')} · {plural(countChars(text), 'char')} · {plural(countLines(text), 'line')}
    </span>
  );
}

export function TextPane({
  title,
  badge,
  value,
  placeholder,
  font = 'ui',
  allowFiles = false,
  fileName,
  actions,
  minHeight,
  ariaLabel,
}: {
  title: string;
  badge?: string;
  value: Signal<string>;
  placeholder: string;
  font?: Font;
  allowFiles?: boolean;
  /** Shown in the footer; set to the file name on upload and cleared on typing. */
  fileName?: Signal<string>;
  actions?: ComponentChildren;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);

  const load = async (file: File | undefined) => {
    if (!file) return;
    try {
      value.value = await readFileAsText(file);
      if (fileName) fileName.value = file.name;
    } catch (e) {
      showToast((e as Error).message || 'Could not read that file.', 'error');
    }
  };

  const drop = allowFiles
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setDropActive(true);
        },
        onDragLeave: () => setDropActive(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDropActive(false);
          void load(e.dataTransfer?.files[0]);
        },
      }
    : {};

  return (
    <PaneFrame
      title={title}
      badge={badge}
      dropActive={dropActive}
      {...drop}
      actions={
        <>
          {actions}
          {allowFiles && (
            <>
              <Button size="sm" variant="ghost" icon="upload" onClick={() => fileInput.current?.click()}>
                Upload
              </Button>
              <input
                ref={fileInput}
                class="visually-hidden"
                type="file"
                accept={ACCEPTED_FILES}
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  void load(e.currentTarget.files?.[0]);
                  e.currentTarget.value = '';
                }}
              />
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="x"
            iconOnly
            label={`Clear ${title.toLowerCase()}`}
            disabled={!value.value}
            onClick={() => {
              value.value = '';
              if (fileName) fileName.value = '';
            }}
          />
        </>
      }
      footer={
        <>
          <span class="pane__file">{fileName?.value || (allowFiles ? 'Paste, type or drop a file' : '')}</span>
          <TextCounts text={value.value} />
        </>
      }
    >
      <textarea
        class={`editor editor--${font}`}
        style={minHeight ? { minHeight } : undefined}
        value={value.value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? title}
        spellcheck={false}
        onInput={(e) => {
          value.value = e.currentTarget.value;
          if (fileName?.value) fileName.value = '';
        }}
      />
    </PaneFrame>
  );
}

export function OutputPane({
  title,
  text,
  font = 'ui',
  fileName,
  sendFrom,
  original,
  onReuse,
  pending,
  minHeight,
  extraFooter,
}: {
  title: string;
  text: string;
  font?: Font;
  /** Download name, e.g. "cleaned.txt". */
  fileName: string;
  /** The current tool's id, excluded from "Send to" targets. */
  sendFrom: string;
  /** The tool's input, passed along so the Diff tool can show before/after. */
  original?: string;
  /** "Use as input": replace the tool's input with this output. */
  onReuse?: () => void;
  pending?: boolean;
  minHeight?: number;
  extraFooter?: ComponentChildren;
}) {
  const payload = (): SentText => ({ text, original });
  return (
    <PaneFrame
      title={title}
      class={pending ? 'is-pending' : undefined}
      actions={
        <>
          {onReuse && (
            <Button size="sm" variant="ghost" icon="reuse" iconOnly label="Use as input" disabled={!text} onClick={onReuse} />
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            iconOnly
            label="Download"
            disabled={!text}
            onClick={() => downloadText(fileName, text)}
          />
          <SendToMenu from={sendFrom} payload={payload} disabled={!text} />
          <Button size="sm" variant="primary" icon="copy" disabled={!text} onClick={() => void copyText(text)}>
            Copy
          </Button>
        </>
      }
      footer={
        <>
          <span class="pane__file">{extraFooter}</span>
          <TextCounts text={text} />
        </>
      }
    >
      <textarea
        class={`editor editor--${font} editor--output`}
        style={minHeight ? { minHeight } : undefined}
        value={text}
        readOnly
        aria-label={title}
        spellcheck={false}
      />
    </PaneFrame>
  );
}
