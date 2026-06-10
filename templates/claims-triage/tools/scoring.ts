// Deterministic fraud + severity scoring — swap for your scoring models.

export const fraudScore = {
  category: "fraud",
  schema: {
    name: "fraud_score",
    description: "Deterministic fraud-risk score (0-100, higher = riskier) from filing timing, claim history, and documentation completeness.",
    parameters: {
      type: "object" as const,
      properties: {
        filedDaysAfterInception: { type: "number", description: "Days between policy inception and claim filing" },
        priorClaims: { type: "number", description: "Prior claims by this policyholder" },
        docsComplete: { type: "boolean", description: "Whether supporting documentation is complete" },
      },
      required: ["filedDaysAfterInception", "priorClaims", "docsComplete"],
    },
  },
  async execute({ filedDaysAfterInception, priorClaims, docsComplete }:
    { filedDaysAfterInception: number; priorClaims: number; docsComplete: boolean }) {
    const factors = [
      { factor: "filing_timing", weight: 40, score: Math.max(0, 100 - filedDaysAfterInception * 1.2), band: filedDaysAfterInception <= 30 ? "high" : filedDaysAfterInception <= 90 ? "medium" : "low" },
      { factor: "claim_history", weight: 35, score: Math.min(100, priorClaims * 28), band: priorClaims >= 3 ? "high" : priorClaims >= 1 ? "medium" : "low" },
      { factor: "documentation", weight: 25, score: docsComplete ? 5 : 80, band: docsComplete ? "low" : "high" },
    ];
    const score = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return {
      score,
      band: score >= 60 ? "high" : score >= 30 ? "medium" : "low",
      recommendation: score >= 60 ? "refer to SIU (special investigations)" : score >= 30 ? "request additional documentation" : "no fraud indicators — proceed",
      factors,
    };
  },
};

export const estimateSeverity = {
  category: "severity",
  schema: {
    name: "estimate_severity",
    description: "Estimate claim severity band and recommended reserve from repair estimate, injuries, and policy deductible.",
    parameters: {
      type: "object" as const,
      properties: {
        estimatedRepairUsd: { type: "number", description: "Estimated repair/replacement cost in USD" },
        injuries: { type: "boolean", description: "Whether bodily injury is reported" },
        deductibleUsd: { type: "number", description: "Policy deductible in USD (default 1000)" },
      },
      required: ["estimatedRepairUsd", "injuries"],
    },
  },
  async execute({ estimatedRepairUsd, injuries, deductibleUsd = 1000 }:
    { estimatedRepairUsd: number; injuries: boolean; deductibleUsd?: number }) {
    const injuryLoadUsd = injuries ? Math.max(15000, estimatedRepairUsd * 0.8) : 0;
    const indemnity = Math.max(0, estimatedRepairUsd - deductibleUsd) + injuryLoadUsd;
    const reserve = Math.round(indemnity * 1.15); // 15% loss-adjustment cushion
    const band = injuries || reserve > 40000 ? "severe" : reserve > 15000 ? "moderate" : "light";
    return {
      band,
      indemnityEstimateUsd: Math.round(indemnity),
      recommendedReserveUsd: reserve,
      components: { repairUsd: estimatedRepairUsd, deductibleUsd, injuryLoadUsd: Math.round(injuryLoadUsd), lossAdjustmentPct: 15 },
      handling: band === "severe" ? "assign senior adjuster" : band === "moderate" ? "standard adjuster queue" : "eligible for straight-through processing",
    };
  },
};
