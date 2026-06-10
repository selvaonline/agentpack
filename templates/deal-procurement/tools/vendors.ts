// Deterministic supplier base — swap for your ERP / vendor-master API.

const VENDORS = [
  { id: "VND-001", name: "NimbusCompute", category: "cloud-infra", region: "US", unitPriceUsd: 0.052, unit: "vCPU-hour", onTimePct: 99.2, defectRatePct: 0.4, financialScore: 88, singleSource: false, note: "Hyperscaler reseller with committed-use discounts." },
  { id: "VND-002", name: "TerraHost", category: "cloud-infra", region: "EU", unitPriceUsd: 0.047, unit: "vCPU-hour", onTimePct: 97.8, defectRatePct: 1.1, financialScore: 72, singleSource: false, note: "EU-sovereign cloud; cheaper but younger balance sheet." },
  { id: "VND-003", name: "SwiftParcel", category: "logistics", region: "US", unitPriceUsd: 7.4, unit: "parcel", onTimePct: 94.5, defectRatePct: 2.3, financialScore: 81, singleSource: false, note: "National parcel network, strong B2C lanes." },
  { id: "VND-004", name: "CargoLink", category: "logistics", region: "APAC", unitPriceUsd: 6.1, unit: "parcel", onTimePct: 91.2, defectRatePct: 3.8, financialScore: 64, singleSource: true, note: "Lowest rate; only carrier covering all APAC lanes we need." },
  { id: "VND-005", name: "BoxCraft", category: "packaging", region: "US", unitPriceUsd: 0.83, unit: "carton", onTimePct: 98.6, defectRatePct: 0.9, financialScore: 90, singleSource: false, note: "Recycled-content cartons, 2 plants near our DCs." },
  { id: "VND-006", name: "PackRight", category: "packaging", region: "MX", unitPriceUsd: 0.71, unit: "carton", onTimePct: 95.1, defectRatePct: 2.0, financialScore: 76, singleSource: false, note: "Cheaper nearshore option; longer lead times." },
  { id: "VND-007", name: "HelixDesk", category: "it-services", region: "IN", unitPriceUsd: 28, unit: "ticket", onTimePct: 96.4, defectRatePct: 1.6, financialScore: 83, singleSource: false, note: "24/7 L1/L2 service desk, ITIL-aligned." },
  { id: "VND-008", name: "CoreSupport", category: "it-services", region: "US", unitPriceUsd: 41, unit: "ticket", onTimePct: 98.9, defectRatePct: 0.7, financialScore: 92, singleSource: false, note: "Premium onshore desk; best CSAT in the base." },
];

export const searchVendors = {
  category: "sourcing",
  schema: {
    name: "search_vendors",
    description: "Find vendors in the supplier base by name, category, and/or region, with pricing and performance data.",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Vendor name lookup, e.g. 'CargoLink'" },
        category: { type: "string", description: "cloud-infra | logistics | packaging | it-services" },
        region: { type: "string", description: "Optional region filter, e.g. US, EU, APAC" },
        maxUnitPriceUsd: { type: "number", description: "Optional max unit price" },
      },
      required: [],
    },
  },
  async execute({ name, category, region, maxUnitPriceUsd }: { name?: string; category?: string; region?: string; maxUnitPriceUsd?: number }) {
    const matches = VENDORS.filter((v) =>
      (!name || v.name.toLowerCase().includes(name.toLowerCase().trim())) &&
      (!category || v.category.includes(category.toLowerCase().trim())) &&
      (!region || v.region.toLowerCase() === region.toLowerCase().trim()) &&
      (maxUnitPriceUsd === undefined || v.unitPriceUsd <= maxUnitPriceUsd)
    );
    return { count: matches.length, matches };
  },
};

export const supplierRisk = {
  category: "risk",
  schema: {
    name: "supplier_risk",
    description: "Deterministic supplier risk score (0-100, higher = riskier) from on-time %, defect rate, financial health, and single-source exposure.",
    parameters: {
      type: "object" as const,
      properties: {
        onTimePct: { type: "number", description: "On-time delivery %" },
        defectRatePct: { type: "number", description: "Defect / SLA-miss rate %" },
        financialScore: { type: "number", description: "Financial health score 0-100 (higher = healthier)" },
        singleSource: { type: "boolean", description: "Is this the only qualified supplier for the need?" },
      },
      required: ["onTimePct", "defectRatePct", "financialScore"],
    },
  },
  async execute({ onTimePct, defectRatePct, financialScore, singleSource = false }: { onTimePct: number; defectRatePct: number; financialScore: number; singleSource?: boolean }) {
    const factors = [
      { factor: "delivery", weight: 30, score: Math.min(100, Math.max(0, (100 - onTimePct) * 12)), band: onTimePct < 93 ? "high" : onTimePct < 97 ? "medium" : "low" },
      { factor: "quality", weight: 25, score: Math.min(100, defectRatePct * 22), band: defectRatePct > 3 ? "high" : defectRatePct > 1.5 ? "medium" : "low" },
      { factor: "financial_health", weight: 25, score: Math.max(0, 100 - financialScore), band: financialScore < 70 ? "high" : financialScore < 85 ? "medium" : "low" },
      { factor: "single_source", weight: 20, score: singleSource ? 90 : 15, band: singleSource ? "high" : "low" },
    ];
    const total = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return {
      riskScore: total,
      rating: total >= 60 ? "HIGH" : total >= 35 ? "MODERATE" : "LOW",
      factors,
      methodology: "weighted factor model: delivery 30%, quality 25%, financial 25%, single-source 20%",
    };
  },
};

const CATEGORIES: Record<string, { priceTrend: string; supplierCount: number; switchingCost: string; notes: string[] }> = {
  "cloud-infra": { priceTrend: "-4%/yr (compute deflation, egress fees rising)", supplierCount: 12, switchingCost: "high — workload migration and egress", notes: ["committed-use discounts deepen at 3-yr terms", "EU sovereignty requirements narrow the field"] },
  "logistics": { priceTrend: "+2%/yr (fuel surcharges volatile)", supplierCount: 23, switchingCost: "medium — integration and label/WMS changes", notes: ["spot rates soft; good window to lock contract rates", "APAC lane capacity remains tight"] },
  "packaging": { priceTrend: "+1%/yr (recycled content premium narrowing)", supplierCount: 31, switchingCost: "low — dual-sourcing is standard", notes: ["nearshore options cut freight but add lead time", "sustainability mandates favor recycled content"] },
  "it-services": { priceTrend: "flat (offshore rates stable, onshore +3%/yr)", supplierCount: 40, switchingCost: "medium — knowledge transfer takes 1-2 quarters", notes: ["AI-assisted desks pushing per-ticket pricing down", "CSAT gap between onshore/offshore narrowing"] },
};

export const categoryIntel = {
  category: "market",
  schema: {
    name: "category_intel",
    description: "Category intelligence: price trend, supplier landscape, switching cost, market notes.",
    parameters: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "cloud-infra | logistics | packaging | it-services" },
      },
      required: ["category"],
    },
  },
  async execute({ category }: { category: string }) {
    const key = category.toLowerCase().trim();
    const hit = CATEGORIES[key] || Object.entries(CATEGORIES).find(([k]) => k.includes(key) || key.includes(k))?.[1];
    return hit ? { category: key, ...hit } : { category: key, error: "no category data — report honestly" };
  },
};
