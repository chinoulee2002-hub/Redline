/**
 * TaskRunner sends tasks to a dedicated background worker.
 *
 * - Latest wins: only one task runs at a time and at most one waits. A newer
 *   request replaces the waiting one, so fast typing never builds a backlog.
 * - Timeouts: with `timeoutMs`, a task that runs too long has its worker
 *   terminated (the only way to stop a runaway regex) and a fresh one started.
 * - Fallback: if workers are unavailable (blocked by the host page's security
 *   policy, for example), tasks run on the main thread instead.
 */
import ComputeWorker from './compute.worker?worker&inline';
import { runHandler, type TaskName, type TaskInput, type TaskOutput, type TaskResponseMessage } from './handlers';

export type TaskErrorKind = 'failed' | 'timeout' | 'superseded';

export class TaskError extends Error {
  constructor(
    message: string,
    readonly kind: TaskErrorKind,
  ) {
    super(message);
  }
}

interface Job {
  task: TaskName;
  input: unknown;
  resolve: (value: unknown) => void;
  reject: (error: TaskError) => void;
}

export class TaskRunner {
  private worker: Worker | null = null;
  private workersUnavailable = typeof Worker === 'undefined';
  private nextId = 1;
  private running: { id: number; job: Job; timer?: ReturnType<typeof setTimeout> } | null = null;
  private waiting: Job | null = null;

  constructor(private readonly timeoutMs = 0) {}

  run<N extends TaskName>(task: N, input: TaskInput<N>): Promise<TaskOutput<N>> {
    return new Promise((resolve, reject) => {
      this.waiting?.reject(new TaskError('Replaced by a newer request', 'superseded'));
      this.waiting = { task, input, resolve: resolve as (v: unknown) => void, reject };
      this.startNext();
    });
  }

  private startNext(): void {
    if (this.running || !this.waiting) return;
    const job = this.waiting;
    this.waiting = null;
    const id = this.nextId++;
    const worker = this.getWorker();

    if (!worker) {
      this.running = { id, job };
      // Yield first so the UI can paint the pending state before blocking work starts.
      setTimeout(() => this.finish(id, () => ({ id, ok: true, result: runHandler(job.task, job.input as never) })));
      return;
    }
    const timer = this.timeoutMs ? setTimeout(() => this.onTimeout(id), this.timeoutMs) : undefined;
    this.running = { id, job, timer };
    worker.postMessage({ id, task: job.task, input: job.input });
  }

  private finish(id: number, produce: () => TaskResponseMessage): void {
    if (this.running?.id !== id) return;
    const { job, timer } = this.running;
    clearTimeout(timer);
    this.running = null;
    let message: TaskResponseMessage;
    try {
      message = produce();
    } catch (err) {
      message = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (message.ok) job.resolve(message.result);
    else job.reject(new TaskError(message.error, 'failed'));
    this.startNext();
  }

  private onTimeout(id: number): void {
    if (this.running?.id !== id) return;
    const { job } = this.running;
    this.running = null;
    this.worker?.terminate();
    this.worker = null;
    job.reject(new TaskError(`Stopped after ${this.timeoutMs} ms`, 'timeout'));
    this.startNext();
  }

  private getWorker(): Worker | null {
    if (this.workersUnavailable) return null;
    if (this.worker) return this.worker;
    try {
      const worker = new ComputeWorker();
      worker.addEventListener('message', (e: MessageEvent<TaskResponseMessage>) => this.finish(e.data.id, () => e.data));
      worker.addEventListener('error', (e) => {
        // The worker script failed to load or crashed: switch to the main thread for good
        // and retry whatever was running there.
        e.preventDefault();
        this.useMainThread();
      });
      this.worker = worker;
      return worker;
    } catch {
      this.workersUnavailable = true;
      return null;
    }
  }

  private useMainThread(): void {
    this.workersUnavailable = true;
    this.worker?.terminate();
    this.worker = null;
    if (this.running) {
      const { job, timer } = this.running;
      clearTimeout(timer);
      this.running = null;
      // Put the interrupted job back unless something newer is already waiting.
      if (!this.waiting) this.waiting = job;
      else job.reject(new TaskError('Replaced by a newer request', 'superseded'));
      this.startNext();
    }
  }
}
