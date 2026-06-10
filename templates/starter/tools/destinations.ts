// Deterministic demo tools — no API keys, no network calls.
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
