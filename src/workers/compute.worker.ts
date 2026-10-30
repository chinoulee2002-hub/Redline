/** Worker entry point: receives a task, runs it, posts the result back. */
import { runHandler, type TaskRequestMessage, type TaskResponseMessage } from './handlers';

const scope = self as unknown as {
  addEventListener(type: 'message', fn: (e: MessageEvent<TaskRequestMessage>) => void): void;
  postMessage(message: TaskResponseMessage): void;
};

scope.addEventListener('message', (e) => {
  const { id, task, input } = e.data;
  try {
    scope.postMessage({ id, ok: true, result: runHandler(task, input as never) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
