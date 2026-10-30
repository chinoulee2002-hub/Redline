/**
 * Every task the app can run off the main thread. The worker calls these, and
 * so does the main-thread fallback, so both paths always behave the same.
 * To add a task: add an entry here. Its input and output types flow to callers.
 */
import { convertCase, type CaseId } from '../core/case';
import { cleanText, type CleanStepId } from '../core/clean';
import { compareTexts, type DiffOptions } from '../core/diff';
import { analyzeFrequency, type FrequencyOptions } from '../core/frequency';
import { runRegex, type RegexRequest } from '../core/regex';

export const handlers = {
  diff: (input: { original: string; revised: string; options: DiffOptions }) =>
    compareTexts(input.original, input.revised, input.options),
  convertCase: (input: { text: string; format: CaseId }) => convertCase(input.text, input.format),
  clean: (input: { text: string; steps: CleanStepId[] }) => cleanText(input.text, input.steps),
  frequency: (input: { text: string; options: FrequencyOptions }) => analyzeFrequency(input.text, input.options),
  regex: (input: RegexRequest) => runRegex(input),
};

export type Handlers = typeof handlers;
export type TaskName = keyof Handlers;
export type TaskInput<N extends TaskName> = Parameters<Handlers[N]>[0];
export type TaskOutput<N extends TaskName> = ReturnType<Handlers[N]>;

/** Runs a task by name. Used by both the worker and the fallback path. */
export function runHandler<N extends TaskName>(task: N, input: TaskInput<N>): TaskOutput<N> {
  return (handlers[task] as (i: TaskInput<N>) => TaskOutput<N>)(input);
}

export interface TaskRequestMessage {
  id: number;
  task: TaskName;
  input: unknown;
}

export type TaskResponseMessage = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };
