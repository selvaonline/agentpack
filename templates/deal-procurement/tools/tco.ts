// Deterministic TCO + spend-portfolio models — pure math, zero tokens.

export const tcoModel = {
  category: "finance",
  schema: {
    name: "tco_model",
    description: "Total cost of ownership over a contract term: unit costs at volume, implementation, support, and an optional annual price escalator.",
    parameters: {
      type: "object" as const,
      properties: {
        unitPriceUsd: { type: "number", description: "Price per unit (USD)" },
        annualVolume: { type: "number", description: "Units consumed per year" },
        years: { type: "number", description: "Contract term in years (default 3)" },
        implementationUsd: { type: "number", description: "One-time implementation cost (default 0)" },
        supportPctPerYear: { type: "number", description: "Annual support as % of annual unit spend (default 8)" },
        escalatorPctPerYear: { type: "number", description: "Annual price escalator % (default 0)" },
      },
      required: ["unitPriceUsd", "annualVolume"],
    },
  },
  async execute({ unitPriceUsd, annualVolume, years = 3, implementationUsd = 0, supportPctPerYear = 8, escalatorPctPerYear = 0 }: { unitPriceUsd: number; annualVolume: number; years?: number; implementationUsd?: number; supportPctPerYear?: number; escalatorPctPerYear?: number }) {
    let price = unitPriceUsd, total = implementationUsd;
    const perYear: Array<{ year: number; unitSpend: number; support: number; total: number }> = [];
    for (let y = 1; y <= years; y++) {
      const unitSpend = price * annualVolume;
      const support = unitSpend * (supportPctPerYear / 100);
      perYear.push({ year: y, unitSpend: r0(unitSpend), support: r0(support), total: r0(unitSpend + support) });
      total += unitSpend + support;
      price *= 1 + escalatorPctPerYear / 100;
    }
    return {
      tcoUsd: r0(total),
      avgPerYearUsd: r0((total - implementationUsd) / years),
      effectiveUnitCostUsd: Math.round(((total) / (annualVolume * years)) * 10000) / 10000,
      breakdown: { implementationUsd, perYear },
      assumptions: { years, supportPctPerYear, escalatorPctPerYear },
    };
  },
};

const SPEND_BOOK = [
  { category: "cloud-infra", annualSpendUsd: 4_200_000, suppliers: 2 },
  { category: "logistics", annualSpendUsd: 7_800_000, suppliers: 3 },
  { category: "packaging", annualSpendUsd: 2_100_000, suppliers: 2 },
  { category: "it-services", annualSpendUsd: 1_600_000, suppliers: 1 },
];

export const spendPortfolioFit = {
  category: "portfolio",
  schema: {
    name: "spend_portfolio_fit",
    description: "Spend-portfolio impact of a proposed award: category concentration, supplier diversification, single-source warnings.",
    parameters: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Spend category" },
        proposedAnnualSpendUsd: { type: "number", description: "Proposed annual spend with this vendor (USD)" },
        addsNewSupplier: { type: "boolean", description: "Does this award add a new supplier to the category? (default true)" },
      },
      required: ["category", "proposedAnnualSpendUsd"],
    },
  },
  async execute({ category, proposedAnnualSpendUsd, addsNewSupplier = true }: { category: string; proposedAnnualSpendUsd: number; addsNewSupplier?: boolean }) {
    const key = category.toLowerCase().trim();
    const book = SPEND_BOOK.find((s) => s.category === key || s.category.includes(key) || key.includes(s.category));
    if (!book) return { category: key, error: "category not in spend book — report honestly" };
    const totalSpend = SPEND_BOOK.reduce((s, b) => s + b.annualSpendUsd, 0) + proposedAnnualSpendUsd;
    const newCategorySpend = book.annualSpendUsd + proposedAnnualSpendUsd;
    const suppliersAfter = book.suppliers + (addsNewSupplier ? 1 : 0);
    const warnings: string[] = [];
    if (suppliersAfter <= 1) warnings.push("category remains single-sourced — resilience risk");
    if (newCategorySpend / totalSpend > 0.45) warnings.push("category exceeds 45% of total spend — concentration risk");
    return {
      category: book.category,
      categorySpendAfterUsd: newCategorySpend,
      categoryShareOfTotalPct: Math.round((newCategorySpend / totalSpend) * 1000) / 10,
      suppliersInCategoryAfter: suppliersAfter,
      diversificationImpact: addsNewSupplier ? "improves (adds a qualified supplier)" : "neutral (existing supplier)",
      warnings,
      currentSpendBook: SPEND_BOOK,
    };
  },
};

const r0 = (n: number) => Math.round(n);
