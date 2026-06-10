// agentpack — `agentpack init` scaffold: a complete working example team
// (trip planner) with deterministic mock tools, prompts, and eval cases.
// Tool files are dependency-free: plain objects with schema + execute.

export const TEMPLATE_FILES: Record<string, string> = {
  "agentpack.yaml": `# agentpack.yaml — your agent team, declared
name: trip-planner
description: A travel-planning agent team (agentpack starter example)

supervisor:
  name: trip_advisor
  # prompt: ./prompts/supervisor.md   # optional — a sensible default is generated

specialists:
  - name: destination_scout
    description: Researches destinations, attractions, and seasonal weather.
    prompt: ./prompts/destination_scout.md
    tools: [search_destinations, get_weather]

  - name: budget_planner
    description: Estimates trip costs and builds budget breakdowns.
    prompt: ./prompts/budget_planner.md
    tools: [estimate_costs]

  - name: itinerary_writer
    description: Writes polished day-by-day itineraries from the team's findings.
    prompt: ./prompts/itinerary_writer.md
    tools: []

tools: ./tools
`,

  "prompts/destination_scout.md": `You are the Destination Scout of a travel-planning team.
Use search_destinations to find destination facts and attractions, and
get_weather for seasonal conditions. Always cite which tool data you used.
Report findings as a structured list: destination, highlights, best season,
weather notes. Never invent attractions not present in the tool data.
`,

  "prompts/budget_planner.md": `You are the Budget Planner of a travel-planning team.
Use estimate_costs to build cost breakdowns. State every assumption
(travel style, number of travelers). Present a table: category, per-day cost,
total. Flag when a requested budget looks insufficient — be direct about it.
`,

  "prompts/itinerary_writer.md": `You are the Itinerary Writer of a travel-planning team.
Write a clear day-by-day itinerary using ONLY facts supplied in the
conversation (destinations, weather, costs from other specialists).
Format: ## Day N — Title, followed by morning / afternoon / evening bullets.
End with a packing tip based on the weather notes.
`,

  "tools/destinations.ts": `// Deterministic demo tools — no API keys, no network calls.
// A tool is any object with { schema, execute } — no imports required.

const DESTINATIONS: Record<string, { highlights: string[]; bestSeason: string; region: string }> = {
  japan: { highlights: ["Kyoto temples", "Tokyo food scene", "Mount Fuji views", "cherry blossoms (Mar-Apr)"], bestSeason: "spring", region: "Asia" },
  italy: { highlights: ["Rome ruins", "Florence galleries", "Amalfi coast", "Venice canals"], bestSeason: "spring/fall", region: "Europe" },
  peru: { highlights: ["Machu Picchu", "Sacred Valley", "Lima gastronomy", "Lake Titicaca"], bestSeason: "dry season (May-Sep)", region: "South America" },
  iceland: { highlights: ["Northern lights (Sep-Mar)", "Golden Circle", "Blue Lagoon", "glacier hikes"], bestSeason: "summer or aurora season", region: "Europe" },
  thailand: { highlights: ["Bangkok temples", "Chiang Mai old city", "island hopping", "street food"], bestSeason: "Nov-Feb", region: "Asia" },
};

export const searchDestinations = {
  category: "research",
  schema: {
    name: "search_destinations",
    description: "Look up destination facts: highlights, best season, region. Returns matches for a query.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Destination name or theme, e.g. 'Japan' or 'beaches in Asia'" },
      },
      required: ["query"],
    },
  },
  async execute({ query }: { query: string }) {
    const q = query.toLowerCase();
    const matches = Object.entries(DESTINATIONS)
      .filter(([name, d]) => q.includes(name) || d.region.toLowerCase().includes(q) || d.highlights.some(h => q.includes(h.split(" ")[0].toLowerCase())))
      .map(([name, d]) => ({ destination: name, ...d }));
    return { query, matches: matches.length ? matches : Object.entries(DESTINATIONS).map(([name, d]) => ({ destination: name, ...d })).slice(0, 3) };
  },
};

const WEATHER: Record<string, Record<string, string>> = {
  japan: { spring: "12-20°C, mild, cherry blossoms", summer: "25-33°C, humid, rainy season in June", fall: "10-22°C, crisp, foliage", winter: "0-10°C, dry, snow in the north" },
  italy: { spring: "12-22°C, pleasant", summer: "24-35°C, hot and crowded", fall: "12-24°C, harvest season", winter: "3-12°C, quiet" },
  peru: { spring: "8-20°C in highlands", summer: "wet season in the Andes", fall: "drying out, fewer crowds", winter: "dry season — best for trekking" },
  iceland: { spring: "0-7°C, windy", summer: "8-15°C, midnight sun", fall: "2-8°C, auroras begin", winter: "-3-3°C, dark, aurora prime time" },
  thailand: { spring: "30-36°C, hottest months", summer: "28-33°C, monsoon", fall: "27-32°C, rains taper", winter: "24-31°C, dry and pleasant" },
};

export const getWeather = {
  category: "research",
  schema: {
    name: "get_weather",
    description: "Seasonal weather profile for a destination and season.",
    parameters: {
      type: "object" as const,
      properties: {
        destination: { type: "string", description: "Destination name, e.g. 'Japan'" },
        season: { type: "string", description: "spring | summer | fall | winter", enum: ["spring", "summer", "fall", "winter"] },
      },
      required: ["destination", "season"],
    },
  },
  async execute({ destination, season }: { destination: string; season: string }) {
    const d = destination.toLowerCase();
    const profile = WEATHER[d]?.[season];
    return profile
      ? { destination, season, profile }
      : { destination, season, profile: null, note: "no weather data for this destination — say so honestly" };
  },
};
`,

  "tools/budget.ts": `// Deterministic cost model — pure math, golden-testable, zero tokens.

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
    if (!daily || !flight) return { error: \`no cost model for region "\${region}" / style "\${style}"\` };
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
`,

  "evals/cases.json": `{
  "comment": "Behavioral evals — run with: npx agentpack eval (server must be running)",
  "cases": [
    {
      "name": "routing_budget",
      "query": "What would a 7-day mid-range trip to Italy cost for 2 people?",
      "expect_specialists": ["budget_planner"],
      "min_tool_calls": { "estimate_costs": 1 },
      "expect_keywords": ["total"],
      "budget_s": 90
    },
    {
      "name": "completeness_full_plan",
      "query": "Plan a 5-day trip to Japan in spring on a $3000 budget: research the destination, estimate the costs, and write a day-by-day itinerary.",
      "expect_specialists": ["destination_scout", "budget_planner", "itinerary_writer"],
      "min_specialists": 3,
      "expect_keywords": ["day"],
      "budget_s": 240
    },
    {
      "name": "honesty_refusal",
      "query": "Write me a Python web scraper.",
      "expect_no_delegation": true,
      "budget_s": 60
    }
  ]
}
`,

  ".env.example": `# One LLM key is required (any of these):
OPENAI_API_KEY=
# GEMINI_API_KEY=
# GROQ_API_KEY=

# Optional model overrides:
# AGENTPACK_MODEL=gpt-4o-mini
# AGENTPACK_SUPERVISOR_MODEL=gpt-4o
`,

  "README.md": `# trip-planner — an agentpack team

A travel-planning agent team: a supervisor delegating to a destination
scout, a budget planner, and an itinerary writer over deterministic demo
tools (no external APIs needed).

\`\`\`bash
cp .env.example .env       # add one LLM key
npx agentpack dev          # http://localhost:3000 — live network UI + MCP at /mcp
npx agentpack eval         # behavioral evals against the running server
\`\`\`

Try: *"Plan a 5-day trip to Japan in spring on a $3000 budget: research the
destination, estimate the costs, and write a day-by-day itinerary."*

Edit \`agentpack.yaml\` to reshape the team — add a specialist, point it at
new tools in \`./tools\`, restart. That's the whole workflow.
`,
};
