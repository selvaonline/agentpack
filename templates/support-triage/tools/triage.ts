// Deterministic known-issue matching + priority scoring — swap for your KB/rules.

const KNOWN_ISSUES = [
  { id: "KB-101", match: ["saml", "sso", "assertion"], title: "SAML clock-skew after IdP certificate rotation", fix: "Re-upload the IdP metadata and allow 5 min clock skew in SSO settings.", component: "auth", knownSince: "2026-05-12" },
  { id: "KB-102", match: ["export", "truncate", "10,000", "csv"], title: "CSV export row cap on legacy plan tier", fix: "Enable paginated export in Settings → Data, or upgrade the workspace tier.", component: "exports", knownSince: "2026-03-02" },
  { id: "KB-103", match: ["503", "all api", "failing"], title: "Gateway saturation during regional failover", fix: "Escalate to on-call SRE — requires manual traffic rebalance (runbook RB-7).", component: "api-gateway", knownSince: "2026-06-01" },
  { id: "KB-104", match: ["webhook", "delayed", "delay"], title: "Webhook queue backlog when a consumer endpoint is slow", fix: "Identify the slow consumer in delivery logs; enable per-endpoint circuit breaker.", component: "webhooks", knownSince: "2026-04-20" },
];

export const matchKnownIssues = {
  category: "diagnosis",
  schema: {
    name: "match_known_issues",
    description: "Match symptom text against the known-issue database. Returns candidate issues with fixes and components.",
    parameters: {
      type: "object" as const,
      properties: {
        symptoms: { type: "string", description: "Symptom text, e.g. 'all api requests failing with 503'" },
      },
      required: ["symptoms"],
    },
  },
  async execute({ symptoms }: { symptoms: string }) {
    const s = symptoms.toLowerCase();
    const matches = KNOWN_ISSUES
      .map((k) => ({ ...k, hits: k.match.filter((m) => s.includes(m)).length }))
      .filter((k) => k.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .map(({ match, hits, ...rest }) => ({ ...rest, confidence: hits >= 2 ? "high" : "medium" }));
    return matches.length
      ? { matched: true, candidates: matches }
      : { matched: false, note: "no known issue matches — treat as novel and escalate to engineering" };
  },
};

export const scorePriority = {
  category: "priority",
  schema: {
    name: "score_priority",
    description: "Deterministic P1-P4 priority and SLA from outage scope, users affected, and customer value.",
    parameters: {
      type: "object" as const,
      properties: {
        fullOutage: { type: "boolean", description: "Whether the customer is fully down" },
        usersAffected: { type: "number", description: "Users affected" },
        annualSpendUsd: { type: "number", description: "Customer annual spend in USD" },
        slaTier: { type: "string", description: "premium | standard (default standard)" },
      },
      required: ["fullOutage", "usersAffected", "annualSpendUsd"],
    },
  },
  async execute({ fullOutage, usersAffected, annualSpendUsd, slaTier = "standard" }:
    { fullOutage: boolean; usersAffected: number; annualSpendUsd: number; slaTier?: string }) {
    let points = 0;
    points += fullOutage ? 50 : 0;
    points += usersAffected >= 1000 ? 30 : usersAffected >= 100 ? 20 : usersAffected >= 10 ? 10 : 2;
    points += annualSpendUsd >= 50000 ? 20 : annualSpendUsd >= 5000 ? 10 : 3;
    const priority = points >= 70 ? "P1" : points >= 45 ? "P2" : points >= 20 ? "P3" : "P4";
    const SLA: Record<string, Record<string, string>> = {
      premium: { P1: "15 min response / 4 h workaround", P2: "1 h / 8 h", P3: "4 h / 3 days", P4: "1 day / best effort" },
      standard: { P1: "1 h response / 8 h workaround", P2: "4 h / 2 days", P3: "1 day / 5 days", P4: "2 days / best effort" },
    };
    const tier = slaTier.toLowerCase() === "premium" ? "premium" : "standard";
    return {
      priority,
      points,
      slaTier: tier,
      sla: SLA[tier][priority],
      escalate: priority === "P1" ? "page on-call engineer now" : priority === "P2" ? "assign senior support engineer" : "standard queue",
    };
  },
};
