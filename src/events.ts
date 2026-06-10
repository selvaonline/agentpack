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

// ── human-in-the-loop approvals ──────────────────────────────────────────────
// A specialist marked `approval: true` pauses its run until the user resolves
// the request (POST /api/approve) or the timeout auto-denies it.
const pendingApprovals = new Map<string, (approved: boolean) => void>();

export function waitForApproval(
  runId: string, approvalId: string, timeoutMs = 5 * 60 * 1000
): Promise<boolean> {
  const key = `${runId}:${approvalId}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(key);
      resolve(false);
    }, timeoutMs);
    timer.unref?.();
    pendingApprovals.set(key, (approved) => {
      clearTimeout(timer);
      pendingApprovals.delete(key);
      resolve(approved);
    });
  });
}

/** Returns false if there is no matching pending approval. */
export function resolveApproval(runId: string, approvalId: string, approved: boolean): boolean {
  const fn = pendingApprovals.get(`${runId}:${approvalId}`);
  if (!fn) return false;
  fn(approved);
  return true;
}
