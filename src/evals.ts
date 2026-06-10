// agentpack — behavioral eval harness. Drives the running server through the
// same SSE contract the dev UI uses, so it validates the full stack:
// routing, completeness, honesty/refusal, resilience, latency budgets.
import fs from "node:fs";

export interface EvalCase {
  name: string;
  query: string;
  /** Specialists that MUST be delegated to. */
  expect_specialists?: string[];
  /** At least this many of expect_specialists must run (default: all). */
  min_specialists?: number;
  /** All of these must appear in the answer (case-insensitive). */
  expect_keywords?: string[];
  /** At least one of these must appear in the answer. */
  expect_any_keywords?: string[];
  /** Refusal check: NO specialists may be invoked. */
  expect_no_delegation?: boolean;
  /** Tool name -> minimum invocation count. */
  min_tool_calls?: Record<string, number>;
  /** Latency budget in seconds — warn at 1x, fail at 2x. */
  budget_s?: number;
}

interface RunResult {
  specialists: string[];
  toolCalls: Record<string, number>;
  answer: string;
  ok: boolean | null;
  durationS: number;
}

async function runQuery(apiUrl: string, query: string, timeoutS: number): Promise<RunResult> {
  const start = await fetch(`${apiUrl}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!start.ok) throw new Error(`POST /api/run -> ${start.status}`);
  const { runId } = await start.json() as { runId: string };

  const out: RunResult = { specialists: [], toolCalls: {}, answer: "", ok: null, durationS: 0 };
  const t0 = Date.now();
  const res = await fetch(`${apiUrl}/events/${runId}`, { signal: AbortSignal.timeout((timeoutS * 2 + 60) * 1000) });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let ev: any;
      try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.kind === "hop") {
        if (ev.targetType === "specialist" && !out.specialists.includes(ev.target)) out.specialists.push(ev.target);
        if (ev.targetType === "tool") out.toolCalls[ev.target] = (out.toolCalls[ev.target] || 0) + 1;
      } else if (ev.kind === "answer_chunk") {
        out.answer += ev.text || "";
      } else if (ev.kind === "run_finished") {
        out.ok = ev.ok;
        break outer;
      }
    }
  }
  out.durationS = Math.round((Date.now() - t0) / 10) / 100;
  return out;
}

function checkCase(c: EvalCase, r: RunResult): string[] {
  const problems: string[] = [];
  const answer = r.answer.toLowerCase();

  if (c.expect_no_delegation && r.specialists.length > 0) {
    problems.push(`expected NO delegation, got ${JSON.stringify(r.specialists)}`);
  }
  if (c.expect_specialists) {
    const hit = c.expect_specialists.filter((s) => r.specialists.includes(s));
    const need = c.min_specialists ?? c.expect_specialists.length;
    if (hit.length < need) {
      problems.push(`only ${hit.length}/${need} required specialists ran (got ${JSON.stringify(r.specialists)})`);
    }
  }
  for (const kw of c.expect_keywords || []) {
    if (!answer.includes(kw.toLowerCase())) problems.push(`answer missing "${kw}"`);
  }
  if (c.expect_any_keywords?.length) {
    if (!c.expect_any_keywords.some((kw) => answer.includes(kw.toLowerCase()))) {
      problems.push(`answer contains none of ${JSON.stringify(c.expect_any_keywords)}`);
    }
  }
  for (const [toolName, min] of Object.entries(c.min_tool_calls || {})) {
    const n = r.toolCalls[toolName] || 0;
    if (n < min) problems.push(`${toolName} called ${n}x, expected >= ${min}`);
  }
  if (!r.answer.trim()) problems.push("no answer produced");
  return problems;
}

export async function runEvals(
  casesPath: string,
  apiUrl: string,
  opts: { only?: string; skip?: string[] } = {}
): Promise<number> {
  const { cases } = JSON.parse(fs.readFileSync(casesPath, "utf-8")) as { cases: EvalCase[] };
  let passed = 0, failed = 0, skipped = 0;

  for (const c of cases) {
    if (opts.only && c.name !== opts.only) continue;
    if (opts.skip?.includes(c.name)) { console.log(`SKIP ${c.name}`); skipped++; continue; }
    const budget = c.budget_s ?? 300;
    console.log(`--- ${c.name}`);
    let r: RunResult;
    try {
      r = await runQuery(apiUrl, c.query, budget);
    } catch (e: any) {
      console.log(`FAIL ${c.name} — ${e?.message || e}`); failed++; continue;
    }
    const problems = checkCase(c, r);
    if (r.durationS > budget * 2) problems.push(`latency ${r.durationS}s exceeds 2x budget (${budget}s)`);
    else if (r.durationS > budget) console.log(`  WARN latency ${r.durationS}s over budget ${budget}s`);
    console.log(`  agents=${JSON.stringify(r.specialists)} tools=${JSON.stringify(r.toolCalls)} ${r.durationS}s`);
    if (problems.length) { console.log(`FAIL ${c.name} — ${problems.join("; ")}`); failed++; }
    else { console.log(`PASS ${c.name}`); passed++; }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  return failed === 0 ? 0 : 1;
}
