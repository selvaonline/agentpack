// Deterministic coverage-universe dataset — swap for your market-data API.

const UNIVERSE = [
  { ticker: "MRSM", name: "Meridian Semis", sector: "semiconductors", priceUsd: 84, sharesM: 412, revenueM: 3120, revenueGrowthPct: 19, grossMarginPct: 58, fcfMarginPct: 21, netDebtM: -450, accrualsRatio: 0.04, receivablesDays: 48, inventoryDays: 61, auditFlags: 0 },
  { ticker: "AURG", name: "Aurora Grid", sector: "utilities-tech", priceUsd: 31, sharesM: 240, revenueM: 980, revenueGrowthPct: 8, grossMarginPct: 41, fcfMarginPct: 12, netDebtM: 820, accrualsRatio: 0.11, receivablesDays: 92, inventoryDays: 14, auditFlags: 1 },
  { ticker: "FLXP", name: "FluxPay", sector: "software", priceUsd: 57, sharesM: 188, revenueM: 840, revenueGrowthPct: 24, grossMarginPct: 71, fcfMarginPct: 22, netDebtM: -210, accrualsRatio: 0.03, receivablesDays: 39, inventoryDays: 0, auditFlags: 0 },
  { ticker: "NMBL", name: "Nimbus Labs", sector: "software", priceUsd: 22, sharesM: 310, revenueM: 510, revenueGrowthPct: 31, grossMarginPct: 76, fcfMarginPct: -4, netDebtM: -120, accrualsRatio: 0.07, receivablesDays: 55, inventoryDays: 0, auditFlags: 0 },
  { ticker: "TRRA", name: "TerraHaul", sector: "industrials", priceUsd: 46, sharesM: 150, revenueM: 2240, revenueGrowthPct: 5, grossMarginPct: 28, fcfMarginPct: 8, netDebtM: 1340, accrualsRatio: 0.09, receivablesDays: 71, inventoryDays: 88, auditFlags: 0 },
  { ticker: "BIOQ", name: "BioQuanta", sector: "biotech", priceUsd: 12, sharesM: 95, revenueM: 60, revenueGrowthPct: 64, grossMarginPct: 88, fcfMarginPct: -120, netDebtM: -300, accrualsRatio: 0.02, receivablesDays: 33, inventoryDays: 25, auditFlags: 0 },
  { ticker: "HLOS", name: "Helios Foods", sector: "consumer", priceUsd: 68, sharesM: 520, revenueM: 8900, revenueGrowthPct: 3, grossMarginPct: 34, fcfMarginPct: 9, netDebtM: 2100, accrualsRatio: 0.13, receivablesDays: 64, inventoryDays: 102, auditFlags: 2 },
  { ticker: "QNTC", name: "Quantic Networks", sector: "semiconductors", priceUsd: 119, sharesM: 96, revenueM: 1410, revenueGrowthPct: 16, grossMarginPct: 62, fcfMarginPct: 25, netDebtM: -90, accrualsRatio: 0.05, receivablesDays: 44, inventoryDays: 70, auditFlags: 0 },
];

export const screenCompanies = {
  category: "screening",
  schema: {
    name: "screen_companies",
    description: "Screen the coverage universe by name/ticker, sector, and/or fundamentals. Returns matching companies with summary figures.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Name or ticker lookup, e.g. 'Meridian' or 'MRSM'" },
        sector: { type: "string", description: "e.g. semiconductors, software, utilities-tech, industrials, biotech, consumer" },
        minRevenueGrowthPct: { type: "number", description: "Minimum YoY revenue growth %" },
        minFcfMarginPct: { type: "number", description: "Minimum free-cash-flow margin %" },
      },
      required: [],
    },
  },
  async execute({ query, sector, minRevenueGrowthPct, minFcfMarginPct }:
    { query?: string; sector?: string; minRevenueGrowthPct?: number; minFcfMarginPct?: number }) {
    const q = query?.toLowerCase().trim();
    const matches = UNIVERSE.filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase() === q) &&
      (!sector || c.sector.includes(sector.toLowerCase().trim())) &&
      (minRevenueGrowthPct === undefined || c.revenueGrowthPct >= minRevenueGrowthPct) &&
      (minFcfMarginPct === undefined || c.fcfMarginPct >= minFcfMarginPct)
    ).map(({ ticker, name, sector, priceUsd, revenueM, revenueGrowthPct, fcfMarginPct }) =>
      ({ ticker, name, sector, priceUsd, revenueM, revenueGrowthPct, fcfMarginPct }));
    return { count: matches.length, matches };
  },
};

export const getFundamentals = {
  category: "screening",
  schema: {
    name: "get_fundamentals",
    description: "Full fundamental dataset for one company: price, share count, revenue, growth, margins, net debt, accruals, working-capital days, audit flags.",
    parameters: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Ticker, e.g. MRSM" },
      },
      required: ["ticker"],
    },
  },
  async execute({ ticker }: { ticker: string }) {
    const c = UNIVERSE.find((u) => u.ticker.toLowerCase() === ticker.toLowerCase().trim()
      || u.name.toLowerCase().includes(ticker.toLowerCase().trim()));
    return c ? { found: true, company: c } : { found: false, note: `no company "${ticker}" in the coverage universe` };
  },
};
