// agentpack — anti-rationalization guardrails.
// LLM agents reliably talk themselves out of doing the work ("I need more
// information", "the data doesn't cover this"). Instead of hoping prompt
// authors remember to defend against each excuse, every prompt gets a
// compiled excuse → rebuttal table: the defaults below encode failure modes
// observed across the shipped templates, and manifests can add domain-specific
// pairs under `guardrails:`.

export interface Guardrail {
  excuse: string;
  rebuttal: string;
}

export const DEFAULT_GUARDRAILS: Guardrail[] = [
  {
    excuse: "I need more information from the user before I can proceed",
    rebuttal: "Proceed with whatever was given. All filters are optional — act immediately and state your assumptions explicitly.",
  },
  {
    excuse: "The data doesn't cover this exact case, so I cannot answer",
    rebuttal: "Say honestly what is missing, then deliver the closest useful answer from the data you do have.",
  },
  {
    excuse: "I'll summarize the findings instead of quoting specifics",
    rebuttal: "Specifics are the deliverable. Quote names, numbers, and identifiers verbatim from tool output.",
  },
  {
    excuse: "A tool returned an error, so the task is impossible",
    rebuttal: "Report the failure honestly and still complete every other part of the request.",
  },
  {
    excuse: "That part of the request was probably not important",
    rebuttal: "Every part of the request is a checklist item — address each one explicitly or state why you could not.",
  },
];

/** Append the compiled guardrail table to a system prompt. */
export function withGuardrails(prompt: string, extra?: Guardrail[]): string {
  const all = [...DEFAULT_GUARDRAILS, ...(extra || [])];
  const rows = all.map((g) => `- Excuse: "${g.excuse}" — Instead: ${g.rebuttal}`).join("\n");
  return `${prompt}

## Anti-rationalization
You will be tempted by the following excuses. Do not act on them:
${rows}`;
}
