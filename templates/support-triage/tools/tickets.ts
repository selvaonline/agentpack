// Deterministic ticket-queue dataset — swap for your helpdesk API.

const TICKETS = [
  { id: "TIC-481", status: "open", customerId: "CUS-301", subject: "Login fails with SSO after IdP update", symptoms: "saml assertion rejected, users locked out", reportedUsersAffected: 240, fullOutage: false },
  { id: "TIC-482", status: "open", customerId: "CUS-302", subject: "CSV export missing rows", symptoms: "exports truncate at 10,000 rows", reportedUsersAffected: 3, fullOutage: false },
  { id: "TIC-483", status: "closed", customerId: "CUS-303", subject: "Billing invoice formatting", symptoms: "logo misaligned on PDF invoice", reportedUsersAffected: 1, fullOutage: false },
  { id: "TIC-484", status: "open", customerId: "CUS-304", subject: "API returning 503s", symptoms: "all api requests failing with 503 since 09:10 UTC", reportedUsersAffected: 1800, fullOutage: true },
  { id: "TIC-485", status: "open", customerId: "CUS-301", subject: "Webhook delivery delayed", symptoms: "webhooks delayed ~15 minutes since this morning", reportedUsersAffected: 60, fullOutage: false },
];

const CUSTOMERS = [
  { id: "CUS-301", name: "Northwind Robotics", plan: "enterprise", annualSpendUsd: 96000, openTickets: 2, csatLast90: 4.1, slaTier: "premium" },
  { id: "CUS-302", name: "Bluefin Media", plan: "team", annualSpendUsd: 7200, openTickets: 1, csatLast90: 4.6, slaTier: "standard" },
  { id: "CUS-303", name: "Carver & Holt LLP", plan: "starter", annualSpendUsd: 1188, openTickets: 0, csatLast90: 4.8, slaTier: "standard" },
  { id: "CUS-304", name: "Atlas Freight Cloud", plan: "enterprise", annualSpendUsd: 240000, openTickets: 1, csatLast90: 3.7, slaTier: "premium" },
];

export const searchTickets = {
  category: "intake",
  schema: {
    name: "search_tickets",
    description: "Search the ticket queue by id, status, or text in the subject/symptoms. Returns full ticket records.",
    parameters: {
      type: "object" as const,
      properties: {
        ticketId: { type: "string", description: "Ticket id, e.g. TIC-484" },
        status: { type: "string", description: "open | closed" },
        text: { type: "string", description: "Free-text search against subject and symptoms; any word can match, e.g. 'login failures'" },
      },
      required: [],
    },
  },
  async execute({ ticketId, status, text }: { ticketId?: string; status?: string; text?: string }) {
    const tokens = (text || "").toLowerCase().split(/\W+/).filter((w) => w.length >= 3);
    const matches = TICKETS.filter((x) => {
      const hay = `${x.subject} ${x.symptoms}`.toLowerCase();
      return (!ticketId || x.id.toLowerCase() === ticketId.toLowerCase().trim()) &&
        (!status || x.status === status.toLowerCase().trim()) &&
        (tokens.length === 0 || tokens.some((w) => hay.includes(w)));
    });
    return { count: matches.length, matches };
  },
};

export const getCustomer = {
  category: "intake",
  schema: {
    name: "get_customer",
    description: "Customer profile: plan, annual spend, open tickets, recent CSAT, and SLA tier.",
    parameters: {
      type: "object" as const,
      properties: {
        customerId: { type: "string", description: "Customer id, e.g. CUS-304" },
      },
      required: ["customerId"],
    },
  },
  async execute({ customerId }: { customerId: string }) {
    const c = CUSTOMERS.find((x) => x.id.toLowerCase() === customerId.toLowerCase().trim());
    return c ? { found: true, customer: c } : { found: false, note: `no customer "${customerId}" on file` };
  },
};
