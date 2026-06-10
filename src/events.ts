// agentpack — in-process SSE event bus, keyed by runId.
type Listener = (event: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Listener>>();
const buffers = new Map<string, Array<Record<string, unknown>>>();

const BUFFER_LIMIT = 2000;

export function publish(runId: string, event: Record<string, unknown>): void {
  const buf = buffers.get(runId) || [];
  buf.push(event);
  if (buf.length > BUFFER_LIMIT) buf.shift();
  buffers.set(runId, buf);
  for (const l of listeners.get(runId) || []) l(event);
}

/** Subscribe to a run. Replays buffered events first (late-join safe). */
export function subscribe(runId: string, listener: Listener): () => void {
  for (const e of buffers.get(runId) || []) listener(e);
  const set = listeners.get(runId) || new Set();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(runId);
  };
}

/** Drop buffers for finished runs after a grace period. */
export function scheduleCleanup(runId: string, ms = 10 * 60 * 1000): void {
  setTimeout(() => buffers.delete(runId), ms).unref?.();
}
