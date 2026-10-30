import { useEffect, useRef, useState } from 'preact/hooks';
import { TaskError, type TaskRunner } from '../workers/runner';
import type { TaskInput, TaskName, TaskOutput } from '../workers/handlers';

export interface TaskState<T> {
  /** Last successful result; kept while a newer one is computing so the UI doesn't flash. */
  result: T | null;
  error: TaskError | null;
  pending: boolean;
}

/**
 * Runs a background task whenever `deps` change, after `delayMs` of quiet
 * (debounce: waiting for typing to pause). Results from outdated requests
 * are dropped. Pass `input = null` to clear.
 */
export function useTask<N extends TaskName>(
  runner: TaskRunner,
  task: N,
  input: TaskInput<N> | null,
  deps: readonly unknown[],
  delayMs = 0,
): TaskState<TaskOutput<N>> {
  const [state, setState] = useState<TaskState<TaskOutput<N>>>({ result: null, error: null, pending: false });
  const latest = useRef(0);

  useEffect(() => {
    const token = ++latest.current;
    if (input === null) {
      setState({ result: null, error: null, pending: false });
      return;
    }
    setState((s) => (s.pending ? s : { ...s, pending: true }));
    const timer = setTimeout(() => {
      runner.run(task, input).then(
        (result) => token === latest.current && setState({ result, error: null, pending: false }),
        (error: TaskError) => {
          if (error.kind === 'superseded' || token !== latest.current) return;
          setState((s) => ({ result: s.result, error, pending: false }));
        },
      );
    }, delayMs);
    return () => clearTimeout(timer);
    // `deps` stands in for `input`, which is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
