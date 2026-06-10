// Deterministic risk scoring + sector intel — pure functions, golden-testable.

export const scoreDealRisk = {
  category: "risk",
  schema: {
    name: "score_deal_risk",
    description: "Deterministic diligence risk score (0-100, higher = riskier) from churn, leverage, customer concentration, and litigation.",
    parameters: {
      type: "object" as const,
      properties: {
        churnPct: { type: "number", description: "Annual revenue churn %" },
        leverage: { type: "number", description: "Net debt / EBITDA" },
        topCustomerPct: { type: "number", description: "% of revenue from the largest customer" },
        litigation: { type: "boolean", description: "Open material litigation or regulatory inquiry" },
      },
      required: ["churnPct", "leverage"],
    },
  },
  async execute({ churnPct, leverage, topCustomerPct = 10, litigation = false }: { churnPct: number; leverage: number; topCustomerPct?: number; litigation?: boolean }) {
    const factors = [
      { factor: "churn", weight: 30, score: Math.min(100, churnPct * 8), band: churnPct > 10 ? "high" : churnPct > 6 ? "medium" : "low" },
      { factor: "leverage", weight: 25, score: Math.min(100, leverage * 25), band: leverage > 3 ? "high" : leverage > 2 ? "medium" : "low" },
      { factor: "customer_concentration", weight: 25, score: Math.min(100, topCustomerPct * 3), band: topCustomerPct > 25 ? "high" : topCustomerPct > 15 ? "medium" : "low" },
      { factor: "litigation", weight: 20, score: litigation ? 85 : 10, band: litigation ? "high" : "low" },
    ];
    const total = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return {
      riskScore: total,
      rating: total >= 60 ? "HIGH" : total >= 35 ? "MODERATE" : "LOW",
      factors,
      methodology: "weighted factor model: churn 30%, leverage 25%, concentration 25%, litigation 20%",
    };
  },
};

const SECTORS: Record<string, { growthPct: number; avgEvEbitda: number; tailwinds: string[]; headwinds: string[] }> = {
  "logistics-saas": { growthPct: 14, avgEvEbitda: 13, tailwinds: ["supply-chain digitization", "freight cost pressure drives software adoption"], headwinds: ["freight recession cycles", "consolidation among carriers"] },
  "healthcare-it": { growthPct: 11, avgEvEbitda: 15, tailwinds: ["interoperability mandates", "aging demographics"], headwinds: ["long sales cycles", "compliance cost inflation"] },
  "fintech": { growthPct: 16, avgEvEbitda: 14, tailwinds: ["B2B payments digitization", "embedded finance"], headwinds: ["regulatory scrutiny", "compressed take rates"] },
  "industrial-iot": { growthPct: 12, avgEvEbitda: 11, tailwinds: ["predictive-maintenance ROI", "reshoring capex"], headwinds: ["long hardware refresh cycles", "auto-sector cyclicality"] },
  "retail-tech": { growthPct: 8, avgEvEbitda: 9, tailwinds: ["first-party data push"], headwinds: ["retail margin pressure", "high churn segment"] },
  "energy-software": { growthPct: 18, avgEvEbitda: 16, tailwinds: ["renewables build-out", "grid-flexibility regulation"], headwinds: ["utility procurement is slow", "rate-case dependency"] },
  "legal-tech": { growthPct: 10, avgEvEbitda: 12, tailwinds: ["AI-assisted contract review adoption"], headwinds: ["conservative buyers", "bar-rule constraints"] },
};

export const industryOutlook = {
  category: "market",
  schema: {
    name: "industry_outlook",
    description: "Sector outlook: growth rate, average EV/EBITDA multiple, tailwinds, headwinds.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "Sector key, e.g. logistics-saas, fintech, healthcare-it" },
      },
      required: ["sector"],
    },
  },
  async execute({ sector }: { sector: string }) {
    const key = sector.toLowerCase().trim();
    const hit = SECTORS[key] || Object.entries(SECTORS).find(([k]) => k.includes(key) || key.includes(k))?.[1];
    return hit ? { sector: key, ...hit } : { sector: key, error: "no sector data — report this honestly" };
  },
};
