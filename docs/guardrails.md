# Anti-rationalization guardrails

LLM agents reliably talk themselves out of doing the work:

> *"I need more information from the user."*
> *"The data doesn't cover this exact case, so I cannot answer."*
> *"A tool returned an error, so the task is impossible."*

Instead of hoping every prompt author defends against each excuse, agentpack compiles an **excuse → rebuttal table** into every prompt — supervisor and specialists, including browser-built teams.

## Built-in defaults

| Excuse | Rebuttal |
|---|---|
| "I need more information from the user before I can proceed" | Proceed with whatever was given. All filters are optional — act immediately and state your assumptions explicitly. |
| "The data doesn't cover this exact case, so I cannot answer" | Say honestly what is missing, then deliver the closest useful answer from the data you do have. |
| "I'll summarize the findings instead of quoting specifics" | Specifics are the deliverable. Quote names, numbers, and identifiers verbatim from tool output. |
| "A tool returned an error, so the task is impossible" | Report the failure honestly and still complete every other part of the request. |
| "That part of the request was probably not important" | Every part of the request is a checklist item — address each one explicitly or state why you could not. |

## Domain-specific pairs

Add your own in the manifest; they're appended to the defaults:

```yaml
guardrails:
  - excuse: "This metric is an estimate, so I should not quote it"
    rebuttal: "Quote it and label it as an estimate."
  - excuse: "The claim looks routine, a fraud check is unnecessary"
    rebuttal: "Every claim gets a fraud score. Run it and report the result."
```

## Why a table instead of prose?

Prose instructions get diluted as prompts grow; a structured list of *specific excuses the model is about to make* is much harder for it to rationalize past. Pair guardrails with [evals](evals.md) — especially refusal and completeness cases — to verify the behavior holds.
