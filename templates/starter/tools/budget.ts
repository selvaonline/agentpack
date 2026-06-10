// Deterministic cost model — pure math, golden-testable, zero tokens.

const DAILY_RATES: Record<string, Record<string, number>> = {
  // travel style -> region -> USD/day per person (lodging+food+local transport)
  budget: { Asia: 55, Europe: 95, "South America": 60, "North America": 110 },
  mid: { Asia: 130, Europe: 200, "South America": 140, "North America": 220 },
  luxury: { Asia: 350, Europe: 500, "South America": 380, "North America": 550 },
};
const FLIGHTS: Record<string, number> = { Asia: 1100, Europe: 750, "South America": 850, "North America": 400 };

export const estimateCosts = {
  category: "finance",
  schema: {
    name: "estimate_costs",
    description: "Estimate total trip cost: flights + daily costs by region and travel style.",
    parameters: {
      type: "object" as const,
      properties: {
        region: { type: "string", description: "Asia | Europe | South America | North America" },
        days: { type: "number", description: "Trip length in days" },
        travelers: { type: "number", description: "Number of travelers (default 1)" },
        style: { type: "string", description: "budget | mid | luxury (default mid)", enum: ["budget", "mid", "luxury"] },
      },
      required: ["region", "days"],
    },
  },
  async execute({ region, days, travelers = 1, style = "mid" }: { region: string; days: number; travelers?: number; style?: string }) {
    const daily = DAILY_RATES[style]?.[region];
    const flight = FLIGHTS[region];
    if (!daily || !flight) return { error: `no cost model for region "${region}" / style "${style}"` };
    const perPerson = flight + daily * days;
    return {
      region, days, travelers, style,
      breakdown: { flightPerPerson: flight, dailyPerPerson: daily, daysTotal: daily * days },
      totalPerPerson: perPerson,
      totalTrip: perPerson * travelers,
      currency: "USD",
    };
  },
};
