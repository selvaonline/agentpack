// Deterministic pipeline dataset — swap for your CRM / data-provider API.

interface Target {
  id: string; name: string; sector: string; region: string;
  revenueM: number; growthPct: number; ebitdaM: number; ebitdaMarginPct: number;
  customers: number; topCustomerPct: number; churnPct: number;
  leverage: number; litigation: boolean; notes: string;
}

const PIPELINE: Target[] = [
  { id: "TGT-001", name: "CloudFleet Logistics", sector: "logistics-saas", region: "US", revenueM: 42, growthPct: 28, ebitdaM: 9, ebitdaMarginPct: 21, customers: 310, topCustomerPct: 11, churnPct: 6, leverage: 1.2, litigation: false, notes: "Route-optimization SaaS for mid-market fleets; strong net retention (118%)." },
  { id: "TGT-002", name: "MedChart Systems", sector: "healthcare-it", region: "US", revenueM: 67, growthPct: 19, ebitdaM: 15, ebitdaMarginPct: 22, customers: 140, topCustomerPct: 24, churnPct: 4, leverage: 2.8, litigation: false, notes: "EHR middleware; sticky hospital contracts, heavy compliance moat." },
  { id: "TGT-003", name: "PayBridge", sector: "fintech", region: "EU", revenueM: 88, growthPct: 35, ebitdaM: 12, ebitdaMarginPct: 14, customers: 4200, topCustomerPct: 6, churnPct: 9, leverage: 0.8, litigation: true, notes: "Cross-border B2B payments; open regulatory inquiry in one market." },
  { id: "TGT-004", name: "ForgeSense", sector: "industrial-iot", region: "US", revenueM: 31, growthPct: 22, ebitdaM: 5, ebitdaMarginPct: 16, customers: 85, topCustomerPct: 31, churnPct: 5, leverage: 1.9, litigation: false, notes: "Predictive maintenance sensors; high customer concentration in automotive." },
  { id: "TGT-005", name: "RetailLoop", sector: "retail-tech", region: "US", revenueM: 54, growthPct: 12, ebitdaM: 11, ebitdaMarginPct: 20, customers: 620, topCustomerPct: 9, churnPct: 14, leverage: 3.4, litigation: false, notes: "Loyalty + POS analytics; churn elevated after a botched migration." },
  { id: "TGT-006", name: "GridWise Energy", sector: "energy-software", region: "EU", revenueM: 73, growthPct: 31, ebitdaM: 18, ebitdaMarginPct: 25, customers: 95, topCustomerPct: 18, churnPct: 3, leverage: 1.5, litigation: false, notes: "Grid-balancing software; rides the renewables build-out." },
  { id: "TGT-007", name: "DocuFlow Legal", sector: "legal-tech", region: "US", revenueM: 25, growthPct: 16, ebitdaM: 6, ebitdaMarginPct: 24, customers: 480, topCustomerPct: 7, churnPct: 8, leverage: 0.5, litigation: false, notes: "Contract lifecycle management for mid-size firms; founder-led, clean books." },
  { id: "TGT-008", name: "ShipStream", sector: "logistics-saas", region: "APAC", revenueM: 58, growthPct: 41, ebitdaM: 7, ebitdaMarginPct: 12, customers: 210, topCustomerPct: 15, churnPct: 7, leverage: 2.1, litigation: false, notes: "Freight-forwarding OS; growth-stage, thin margins, APAC expansion." },
];

export const searchTargets = {
  category: "screening",
  schema: {
    name: "search_targets",
    description: "Screen the acquisition pipeline by sector, revenue range, and minimum growth. Returns matching targets with key fundamentals.",
    parameters: {
      type: "object" as const,
      properties: {
        sector: { type: "string", description: "e.g. logistics-saas, healthcare-it, fintech, industrial-iot, retail-tech, energy-software, legal-tech" },
        minRevenueM: { type: "number", description: "Minimum revenue in $M" },
        maxRevenueM: { type: "number", description: "Maximum revenue in $M" },
        minGrowthPct: { type: "number", description: "Minimum YoY growth %" },
      },
      required: [],
    },
  },
  async execute({ sector, minRevenueM, maxRevenueM, minGrowthPct }: { sector?: string; minRevenueM?: number; maxRevenueM?: number; minGrowthPct?: number }) {
    const matches = PIPELINE.filter((t) =>
      (!sector || t.sector.includes(sector.toLowerCase().trim())) &&
      (minRevenueM === undefined || t.revenueM >= minRevenueM) &&
      (maxRevenueM === undefined || t.revenueM <= maxRevenueM) &&
      (minGrowthPct === undefined || t.growthPct >= minGrowthPct)
    ).map(({ id, name, sector, region, revenueM, growthPct, ebitdaM, notes }) => ({ id, name, sector, region, revenueM, growthPct, ebitdaM, notes }));
    return { count: matches.length, matches };
  },
};

export const getCompanyProfile = {
  category: "screening",
  schema: {
    name: "get_company_profile",
    description: "Full profile for one pipeline target by id or name: fundamentals, churn, leverage, concentration, litigation flag.",
    parameters: {
      type: "object" as const,
      properties: {
        target: { type: "string", description: "Target id (e.g. TGT-001) or company name" },
      },
      required: ["target"],
    },
  },
  async execute({ target }: { target: string }) {
    const q = target.toLowerCase().trim();
    const hit = PIPELINE.find((t) => t.id.toLowerCase() === q || t.name.toLowerCase().includes(q));
    return hit ?? { error: `no pipeline target matching "${target}" — report this honestly` };
  },
};
