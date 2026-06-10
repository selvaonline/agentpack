// Deterministic VC math — market sizing, round dilution, multiple valuation.

export const marketSizing = {
  category: "market",
  schema: {
    name: "market_sizing",
    description: "TAM/SAM/SOM from explicit inputs: target customer count, ARPU, serviceable share, obtainable share.",
    parameters: {
      type: "object" as const,
      properties: {
        targetCustomers: { type: "number", description: "Total addressable customer count" },
        arpuUsd: { type: "number", description: "Average revenue per customer per year (USD)" },
        serviceablePct: { type: "number", description: "% of TAM serviceable with current product/geo (default 40)" },
        obtainablePct: { type: "number", description: "% of SAM realistically obtainable in 5 years (default 10)" },
      },
      required: ["targetCustomers", "arpuUsd"],
    },
  },
  async execute({ targetCustomers, arpuUsd, serviceablePct = 40, obtainablePct = 10 }: { targetCustomers: number; arpuUsd: number; serviceablePct?: number; obtainablePct?: number }) {
    const tam = targetCustomers * arpuUsd;
    const sam = tam * (serviceablePct / 100);
    const som = sam * (obtainablePct / 100);
    const fmt = (n: number) => Math.round(n / 1e5) / 10; // $M, 1 decimal
    return {
      tamM: fmt(tam), samM: fmt(sam), somM: fmt(som),
      assumptions: { targetCustomers, arpuUsd, serviceablePct, obtainablePct },
      ventureScale: som >= 100e6 ? "SOM supports venture-scale outcome" : "SOM below $100M — challenge the wedge or expansion story",
    };
  },
};

export const dilutionModel = {
  category: "valuation",
  schema: {
    name: "dilution_model",
    description: "Round math: post-money, new-investor ownership, founder dilution, option pool impact.",
    parameters: {
      type: "object" as const,
      properties: {
        raiseM: { type: "number", description: "Amount raised in $M" },
        preMoneyM: { type: "number", description: "Pre-money valuation in $M" },
        optionPoolPct: { type: "number", description: "New option pool % carved out pre-money (default 10)" },
        founderOwnershipPct: { type: "number", description: "Founders' ownership before the round (default 70)" },
      },
      required: ["raiseM", "preMoneyM"],
    },
  },
  async execute({ raiseM, preMoneyM, optionPoolPct = 10, founderOwnershipPct = 70 }: { raiseM: number; preMoneyM: number; optionPoolPct?: number; founderOwnershipPct?: number }) {
    const postMoneyM = preMoneyM + raiseM;
    const newInvestorPct = (raiseM / postMoneyM) * 100;
    // pool carved pre-money dilutes existing holders
    const founderAfterPool = founderOwnershipPct * (1 - optionPoolPct / 100);
    const founderAfterRound = founderAfterPool * (1 - newInvestorPct / 100);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      postMoneyM: r1(postMoneyM),
      newInvestorPct: r1(newInvestorPct),
      founderOwnershipAfterPct: r1(founderAfterRound),
      founderDilutionPct: r1(founderOwnershipPct - founderAfterRound),
      assumptions: { optionPoolPct, founderOwnershipPct, poolTiming: "pre-money" },
    };
  },
};

const ARR_MULTIPLES: Record<string, { low: number; mid: number; high: number }> = {
  devtools: { low: 8, mid: 12, high: 20 },
  fintech: { low: 6, mid: 10, high: 16 },
  healthtech: { low: 5, mid: 8, high: 13 },
  logistics: { low: 4, mid: 7, high: 11 },
  agtech: { low: 4, mid: 6, high: 9 },
  robotics: { low: 5, mid: 8, high: 12 },
  biotech: { low: 0, mid: 0, high: 0 },
};

export const revenueMultipleValuation = {
  category: "valuation",
  schema: {
    name: "revenue_multiple_valuation",
    description: "Valuation range from ARR and sector revenue multiples. Pre-revenue sectors (e.g. biotech) return no range.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "Sector key, e.g. devtools, fintech, healthtech" },
        arrM: { type: "number", description: "Current ARR in $M" },
      },
      required: ["sector", "arrM"],
    },
  },
  async execute({ sector, arrM }: { sector: string; arrM: number }) {
    const key = sector.toLowerCase().trim();
    const m = ARR_MULTIPLES[key] || Object.entries(ARR_MULTIPLES).find(([k]) => k.includes(key) || key.includes(k))?.[1];
    if (!m) return { sector: key, error: "no multiple data for this sector — report honestly" };
    if (m.mid === 0) return { sector: key, note: "pre-revenue sector — revenue multiples not meaningful; value on milestones/comparable rounds" };
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return { sector: key, multiples: m, valuationRangeM: { low: r1(arrM * m.low), mid: r1(arrM * m.mid), high: r1(arrM * m.high) } };
  },
};

const FUND = {
  thesis: ["devtools", "fintech", "logistics"],
  stageAllocation: { seed: { targetPct: 40, deployedPct: 31 }, "series-a": { targetPct: 45, deployedPct: 47 }, "series-b": { targetPct: 15, deployedPct: 12 } },
  portfolio: [
    { name: "Stackline", sector: "devtools", stage: "series-a" },
    { name: "Payrise", sector: "fintech", stage: "seed" },
    { name: "Dockside", sector: "logistics", stage: "series-a" },
  ],
};

export const fundFit = {
  category: "portfolio",
  schema: {
    name: "fund_fit",
    description: "Fund thesis fit: sector match, stage allocation headroom, portfolio conflicts. Returns fit score 0-100.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "Startup's sector" },
        stage: { type: "string", description: "seed | series-a | series-b" },
      },
      required: ["sector", "stage"],
    },
  },
  async execute({ sector, stage }: { sector: string; stage: string }) {
    const sec = sector.toLowerCase().trim();
    const stg = stage.toLowerCase().trim() as keyof typeof FUND.stageAllocation;
    const inThesis = FUND.thesis.some((t) => sec.includes(t) || t.includes(sec));
    const alloc = FUND.stageAllocation[stg];
    const headroom = alloc ? alloc.targetPct - alloc.deployedPct : 0;
    const conflicts = FUND.portfolio.filter((p) => p.sector === sec);
    const fitScore = (inThesis ? 60 : 25) + Math.max(0, Math.min(25, headroom * 3)) - conflicts.length * 10;
    return {
      fitScore: Math.max(0, Math.min(100, Math.round(fitScore))),
      inThesis,
      thesisSectors: FUND.thesis,
      stageAllocation: alloc ?? { error: `unknown stage "${stage}"` },
      allocationHeadroomPct: headroom,
      portfolioConflicts: conflicts,
    };
  },
};
