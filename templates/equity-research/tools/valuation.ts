// Deterministic valuation + quality math — swap inputs for your data feed.

export const earningsQuality = {
  category: "quality",
  schema: {
    name: "earnings_quality",
    description: "Deterministic earnings-quality score (0-100, higher = cleaner) from accruals, working-capital days, and audit flags.",
    parameters: {
      type: "object" as const,
      properties: {
        accrualsRatio: { type: "number", description: "Total accruals / assets, e.g. 0.04" },
        receivablesDays: { type: "number", description: "Days sales outstanding" },
        inventoryDays: { type: "number", description: "Days inventory outstanding (0 for software)" },
        auditFlags: { type: "number", description: "Count of audit/restatement flags" },
      },
      required: ["accrualsRatio", "receivablesDays", "auditFlags"],
    },
  },
  async execute({ accrualsRatio, receivablesDays, inventoryDays = 0, auditFlags }:
    { accrualsRatio: number; receivablesDays: number; inventoryDays?: number; auditFlags: number }) {
    const factors = [
      { factor: "accruals", weight: 35, score: Math.max(0, 100 - accrualsRatio * 700), band: accrualsRatio <= 0.05 ? "clean" : accrualsRatio <= 0.1 ? "watch" : "aggressive" },
      { factor: "receivables", weight: 25, score: Math.max(0, 100 - Math.max(0, receivablesDays - 40) * 1.6), band: receivablesDays <= 50 ? "clean" : receivablesDays <= 75 ? "watch" : "aggressive" },
      { factor: "inventory", weight: 15, score: Math.max(0, 100 - Math.max(0, inventoryDays - 45) * 1.2), band: inventoryDays <= 60 ? "clean" : inventoryDays <= 90 ? "watch" : "aggressive" },
      { factor: "audit_history", weight: 25, score: Math.max(0, 100 - auditFlags * 40), band: auditFlags === 0 ? "clean" : auditFlags === 1 ? "watch" : "aggressive" },
    ];
    const score = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return {
      score,
      rating: score >= 75 ? "high-quality" : score >= 50 ? "acceptable" : "low-quality",
      factors,
    };
  },
};

export const dcfFairValue = {
  category: "valuation",
  schema: {
    name: "dcf_fair_value",
    description: "Single-stage DCF fair value per share from revenue, FCF margin, growth, discount rate, and share count.",
    parameters: {
      type: "object" as const,
      properties: {
        revenueM: { type: "number", description: "Trailing revenue in $M" },
        fcfMarginPct: { type: "number", description: "Free-cash-flow margin %" },
        growthPct: { type: "number", description: "FCF growth % for the 5-year horizon" },
        discountRatePct: { type: "number", description: "Discount rate %, e.g. 9" },
        terminalGrowthPct: { type: "number", description: "Terminal growth % (default 2.5)" },
        sharesM: { type: "number", description: "Diluted shares outstanding in millions" },
        netDebtM: { type: "number", description: "Net debt in $M (negative = net cash)" },
      },
      required: ["revenueM", "fcfMarginPct", "growthPct", "discountRatePct", "sharesM"],
    },
  },
  async execute({ revenueM, fcfMarginPct, growthPct, discountRatePct, terminalGrowthPct = 2.5, sharesM, netDebtM = 0 }:
    { revenueM: number; fcfMarginPct: number; growthPct: number; discountRatePct: number; terminalGrowthPct?: number; sharesM: number; netDebtM?: number }) {
    const r = discountRatePct / 100, g = growthPct / 100, tg = terminalGrowthPct / 100;
    if (r <= tg) return { error: "discount rate must exceed terminal growth" };
    let fcf = revenueM * (fcfMarginPct / 100);
    let pv = 0;
    const years: Array<{ year: number; fcfM: number; pvM: number }> = [];
    for (let y = 1; y <= 5; y++) {
      fcf *= 1 + g;
      const pvY = fcf / Math.pow(1 + r, y);
      pv += pvY;
      years.push({ year: y, fcfM: Math.round(fcf), pvM: Math.round(pvY) });
    }
    const terminal = (fcf * (1 + tg)) / (r - tg) / Math.pow(1 + r, 5);
    const enterpriseM = Math.round(pv + terminal);
    const equityM = enterpriseM - netDebtM;
    return {
      enterpriseValueM: enterpriseM,
      terminalValueM: Math.round(terminal),
      equityValueM: Math.round(equityM),
      fairValuePerShare: Math.round((equityM / sharesM) * 100) / 100,
      assumptions: { growthPct, discountRatePct, terminalGrowthPct, horizonYears: 5 },
      years,
    };
  },
};

export const peerMultiples = {
  category: "valuation",
  schema: {
    name: "peer_multiples",
    description: "Cross-check value per share using sector EV/Revenue multiple bands.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "semiconductors | software | utilities-tech | industrials | biotech | consumer" },
        revenueM: { type: "number", description: "Trailing revenue in $M" },
        sharesM: { type: "number", description: "Diluted shares in millions" },
        netDebtM: { type: "number", description: "Net debt in $M (negative = net cash)" },
      },
      required: ["sector", "revenueM", "sharesM"],
    },
  },
  async execute({ sector, revenueM, sharesM, netDebtM = 0 }:
    { sector: string; revenueM: number; sharesM: number; netDebtM?: number }) {
    const BANDS: Record<string, { low: number; mid: number; high: number }> = {
      semiconductors: { low: 4, mid: 6, high: 9 },
      software: { low: 5, mid: 8, high: 12 },
      "utilities-tech": { low: 2, mid: 3, high: 4.5 },
      industrials: { low: 1, mid: 1.8, high: 2.6 },
      biotech: { low: 6, mid: 10, high: 16 },
      consumer: { low: 1.2, mid: 2, high: 3 },
    };
    const band = BANDS[sector.toLowerCase().trim()];
    if (!band) return { error: `no multiple band for sector "${sector}"`, sectors: Object.keys(BANDS) };
    const perShare = (mult: number) => Math.round(((revenueM * mult - netDebtM) / sharesM) * 100) / 100;
    return {
      sector,
      evRevenueBand: band,
      valuePerShare: { low: perShare(band.low), mid: perShare(band.mid), high: perShare(band.high) },
    };
  },
};
