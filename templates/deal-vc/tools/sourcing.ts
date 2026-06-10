// Deterministic deal-flow dataset — swap for your CRM / data-provider API.

const DEAL_FLOW = [
  { id: "SU-001", name: "Lumenly", stage: "seed", sector: "devtools", arrM: 0.4, growthPctMoM: 18, raiseM: 3, preMoneyM: 12, foundersExits: 1, domainYears: 8, competitorCount: 6, runwayMonths: 14, thesis: "AI-native observability for LLM apps." },
  { id: "SU-002", name: "Harvestor", stage: "series-a", sector: "agtech", arrM: 2.1, growthPctMoM: 9, raiseM: 12, preMoneyM: 48, foundersExits: 0, domainYears: 15, competitorCount: 3, runwayMonths: 10, thesis: "Yield-prediction platform for specialty crops." },
  { id: "SU-003", name: "Clinic OS", stage: "series-a", sector: "healthtech", arrM: 3.4, growthPctMoM: 11, raiseM: 15, preMoneyM: 60, foundersExits: 2, domainYears: 12, competitorCount: 8, runwayMonths: 16, thesis: "Operating system for independent clinics." },
  { id: "SU-004", name: "Freightly", stage: "seed", sector: "logistics", arrM: 0.7, growthPctMoM: 22, raiseM: 4, preMoneyM: 16, foundersExits: 0, domainYears: 4, competitorCount: 11, runwayMonths: 8, thesis: "Spot-freight marketplace for SMB shippers." },
  { id: "SU-005", name: "Vaultline", stage: "series-b", sector: "fintech", arrM: 9.8, growthPctMoM: 7, raiseM: 40, preMoneyM: 220, foundersExits: 1, domainYears: 10, competitorCount: 5, runwayMonths: 20, thesis: "Treasury automation for mid-market CFOs." },
  { id: "SU-006", name: "Synthwave Bio", stage: "seed", sector: "biotech", arrM: 0, growthPctMoM: 0, raiseM: 6, preMoneyM: 24, foundersExits: 0, domainYears: 9, competitorCount: 2, runwayMonths: 12, thesis: "Enzyme design via generative models (pre-revenue)." },
  { id: "SU-007", name: "Cartesian Robotics", stage: "series-a", sector: "robotics", arrM: 1.8, growthPctMoM: 13, raiseM: 18, preMoneyM: 72, foundersExits: 1, domainYears: 11, competitorCount: 4, runwayMonths: 9, thesis: "Warehouse picking arms sold as RaaS." },
  { id: "SU-008", name: "Brightdesk", stage: "seed", sector: "devtools", arrM: 0.9, growthPctMoM: 15, raiseM: 5, preMoneyM: 20, foundersExits: 0, domainYears: 6, competitorCount: 9, runwayMonths: 18, thesis: "Internal-tools builder with AI agents." },
];

export const searchStartups = {
  category: "sourcing",
  schema: {
    name: "search_startups",
    description: "Source startups from the deal flow by name, stage, and/or sector. Returns candidates with ARR, growth, round terms, and founder data.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Company name lookup, e.g. 'Lumenly'" },
        stage: { type: "string", description: "seed | series-a | series-b" },
        sector: { type: "string", description: "e.g. devtools, agtech, healthtech, logistics, fintech, biotech, robotics" },
        minArrM: { type: "number", description: "Minimum ARR in $M" },
      },
      required: [],
    },
  },
  async execute({ name, stage, sector, minArrM }: { name?: string; stage?: string; sector?: string; minArrM?: number }) {
    const matches = DEAL_FLOW.filter((s) =>
      (!name || s.name.toLowerCase().includes(name.toLowerCase().trim())) &&
      (!stage || s.stage === stage.toLowerCase().trim()) &&
      (!sector || s.sector.includes(sector.toLowerCase().trim())) &&
      (minArrM === undefined || s.arrM >= minArrM)
    );
    return { count: matches.length, matches };
  },
};

export const founderMarketRisk = {
  category: "risk",
  schema: {
    name: "founder_market_risk",
    description: "Deterministic founder/execution risk score (0-100, higher = riskier) from exits, domain depth, competition, and runway.",
    parameters: {
      type: "object" as const,
      properties: {
        foundersExits: { type: "number", description: "Prior successful exits across founders" },
        domainYears: { type: "number", description: "Founders' years of domain experience" },
        competitorCount: { type: "number", description: "Number of funded direct competitors" },
        runwayMonths: { type: "number", description: "Months of runway post-raise" },
      },
      required: ["foundersExits", "domainYears", "competitorCount", "runwayMonths"],
    },
  },
  async execute({ foundersExits, domainYears, competitorCount, runwayMonths }: { foundersExits: number; domainYears: number; competitorCount: number; runwayMonths: number }) {
    const factors = [
      { factor: "founder_track_record", weight: 30, score: Math.max(0, 70 - foundersExits * 30), band: foundersExits >= 1 ? "low" : "medium" },
      { factor: "domain_depth", weight: 25, score: Math.max(0, 80 - domainYears * 7), band: domainYears >= 8 ? "low" : domainYears >= 4 ? "medium" : "high" },
      { factor: "competition", weight: 25, score: Math.min(100, competitorCount * 9), band: competitorCount > 8 ? "high" : competitorCount > 4 ? "medium" : "low" },
      { factor: "runway", weight: 20, score: Math.max(0, 100 - runwayMonths * 6), band: runwayMonths < 10 ? "high" : runwayMonths < 15 ? "medium" : "low" },
    ];
    const total = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return {
      riskScore: total,
      rating: total >= 60 ? "HIGH" : total >= 35 ? "MODERATE" : "LOW",
      factors,
      methodology: "weighted factor model: track record 30%, domain 25%, competition 25%, runway 20%",
    };
  },
};
