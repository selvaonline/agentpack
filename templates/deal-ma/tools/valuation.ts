// Deterministic valuation + portfolio-fit models — pure math, zero tokens.

export const dcfValuation = {
  category: "valuation",
  schema: {
    name: "dcf_valuation",
    description: "5-year DCF: projects EBITDA-derived FCF at a fading growth rate, discounts at WACC, adds an exit-multiple terminal value. Returns enterprise value.",
    parameters: {
      type: "object" as const,
      properties: {
        ebitdaM: { type: "number", description: "Current EBITDA in $M" },
        growthPct: { type: "number", description: "Year-1 growth %, fades 15% per year" },
        fcfConversionPct: { type: "number", description: "FCF as % of EBITDA (default 70)" },
        waccPct: { type: "number", description: "Discount rate % (default 10)" },
        exitMultiple: { type: "number", description: "Terminal EV/EBITDA (default 10)" },
      },
      required: ["ebitdaM", "growthPct"],
    },
  },
  async execute({ ebitdaM, growthPct, fcfConversionPct = 70, waccPct = 10, exitMultiple = 10 }: { ebitdaM: number; growthPct: number; fcfConversionPct?: number; waccPct?: number; exitMultiple?: number }) {
    const wacc = waccPct / 100;
    let ebitda = ebitdaM, g = growthPct / 100, pvFcf = 0;
    const years: Array<{ year: number; ebitdaM: number; fcfM: number; pvM: number }> = [];
    for (let y = 1; y <= 5; y++) {
      ebitda *= 1 + g;
      const fcf = ebitda * (fcfConversionPct / 100);
      const pv = fcf / Math.pow(1 + wacc, y);
      pvFcf += pv;
      years.push({ year: y, ebitdaM: r2(ebitda), fcfM: r2(fcf), pvM: r2(pv) });
      g *= 0.85;
    }
    const terminal = (ebitda * exitMultiple) / Math.pow(1 + wacc, 5);
    return {
      enterpriseValueM: r2(pvFcf + terminal),
      pvOfFcfM: r2(pvFcf),
      pvTerminalM: r2(terminal),
      impliedEntryMultiple: r2((pvFcf + terminal) / ebitdaM),
      assumptions: { fcfConversionPct, waccPct, exitMultiple, growthFade: "15%/yr" },
      projection: years,
    };
  },
};

const COMP_MULTIPLES: Record<string, { low: number; mid: number; high: number }> = {
  "logistics-saas": { low: 10, mid: 13, high: 17 },
  "healthcare-it": { low: 12, mid: 15, high: 19 },
  "fintech": { low: 10, mid: 14, high: 20 },
  "industrial-iot": { low: 8, mid: 11, high: 14 },
  "retail-tech": { low: 7, mid: 9, high: 12 },
  "energy-software": { low: 12, mid: 16, high: 21 },
  "legal-tech": { low: 9, mid: 12, high: 15 },
};

export const comparableMultiples = {
  category: "valuation",
  schema: {
    name: "comparable_multiples",
    description: "EV range from sector comparable EV/EBITDA multiples (low / mid / high).",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "Sector key, e.g. logistics-saas" },
        ebitdaM: { type: "number", description: "Target EBITDA in $M" },
      },
      required: ["sector", "ebitdaM"],
    },
  },
  async execute({ sector, ebitdaM }: { sector: string; ebitdaM: number }) {
    const key = sector.toLowerCase().trim();
    const m = COMP_MULTIPLES[key] || Object.entries(COMP_MULTIPLES).find(([k]) => k.includes(key) || key.includes(k))?.[1];
    if (!m) return { sector: key, error: "no comps for this sector — report honestly" };
    return {
      sector: key,
      multiples: m,
      evRangeM: { low: r2(ebitdaM * m.low), mid: r2(ebitdaM * m.mid), high: r2(ebitdaM * m.high) },
    };
  },
};

const HOLDINGS = [
  { name: "FreightCore", sector: "logistics-saas", revenueM: 120 },
  { name: "ClaimsIQ", sector: "healthcare-it", revenueM: 95 },
  { name: "LedgerPay", sector: "fintech", revenueM: 210 },
];

export const portfolioFit = {
  category: "portfolio",
  schema: {
    name: "portfolio_fit",
    description: "Strategic fit vs. the acquirer's current holdings: overlap, gaps filled, synergy notes, fit score 0-100.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "Target's sector" },
        revenueM: { type: "number", description: "Target revenue in $M" },
      },
      required: ["sector"],
    },
  },
  async execute({ sector, revenueM = 0 }: { sector: string; revenueM?: number }) {
    const key = sector.toLowerCase().trim();
    const overlap = HOLDINGS.filter((h) => h.sector === key);
    const adjacent = HOLDINGS.filter((h) => h.sector !== key);
    const fitScore = overlap.length
      ? 80 - Math.min(20, Math.round((revenueM / (overlap[0].revenueM || 1)) * 10))
      : 55;
    return {
      fitScore,
      currentHoldings: HOLDINGS,
      overlappingHoldings: overlap,
      synergyNotes: overlap.length
        ? `Consolidation play with ${overlap.map((h) => h.name).join(", ")}: shared go-to-market, cross-sell base, infrastructure dedup.`
        : `New vertical for the portfolio — diversification, limited cost synergies; nearest adjacency: ${adjacent[0]?.name ?? "none"}.`,
      gapsFilled: overlap.length ? [] : [key],
    };
  },
};

const r2 = (n: number) => Math.round(n * 100) / 100;
