// Deterministic claims + policy dataset — swap for your claims-core API.

const CLAIMS = [
  { id: "CLM-2031", type: "auto", status: "open", policyId: "POL-88102", filedDaysAfterInception: 412, priorClaims: 0, docsComplete: true, estimatedRepairUsd: 9400, injuries: false, description: "Rear-end collision at low speed; bumper and sensor damage." },
  { id: "CLM-2032", type: "property", status: "open", policyId: "POL-77410", filedDaysAfterInception: 2, priorClaims: 3, docsComplete: false, estimatedRepairUsd: 46000, injuries: false, description: "Kitchen fire shortly after policy start; receipts unavailable." },
  { id: "CLM-2033", type: "auto", status: "open", policyId: "POL-90233", filedDaysAfterInception: 95, priorClaims: 1, docsComplete: true, estimatedRepairUsd: 23800, injuries: true, description: "Intersection collision; passenger whiplash reported." },
  { id: "CLM-2034", type: "property", status: "closed", policyId: "POL-88102", filedDaysAfterInception: 230, priorClaims: 0, docsComplete: true, estimatedRepairUsd: 5200, injuries: false, description: "Hail damage to roof shingles." },
  { id: "CLM-2035", type: "auto", status: "open", policyId: "POL-66120", filedDaysAfterInception: 30, priorClaims: 4, docsComplete: false, estimatedRepairUsd: 31000, injuries: false, description: "Vehicle theft claim; police report pending." },
];

const POLICIES = [
  { id: "POL-88102", holder: "D. Okafor", active: true, line: "auto+property", limitUsd: 100000, deductibleUsd: 1000, exclusions: ["racing", "commercial use"] },
  { id: "POL-77410", holder: "M. Reyes", active: true, line: "property", limitUsd: 250000, deductibleUsd: 2500, exclusions: ["flood"] },
  { id: "POL-90233", holder: "S. Lindqvist", active: true, line: "auto", limitUsd: 50000, deductibleUsd: 500, exclusions: [] },
  { id: "POL-66120", holder: "T. Marsh", active: false, line: "auto", limitUsd: 75000, deductibleUsd: 1500, exclusions: ["unlisted drivers"] },
];

export const lookupClaim = {
  category: "intake",
  schema: {
    name: "lookup_claim",
    description: "Look up claims by id, type, or status. Returns full claim records including fraud-relevant signals.",
    parameters: {
      type: "object" as const,
      properties: {
        claimId: { type: "string", description: "Claim id, e.g. CLM-2031" },
        type: { type: "string", description: "auto | property" },
        status: { type: "string", description: "open | closed" },
      },
      required: [],
    },
  },
  async execute({ claimId, type, status }: { claimId?: string; type?: string; status?: string }) {
    const matches = CLAIMS.filter((c) =>
      (!claimId || c.id.toLowerCase() === claimId.toLowerCase().trim()) &&
      (!type || c.type === type.toLowerCase().trim()) &&
      (!status || c.status === status.toLowerCase().trim())
    );
    return { count: matches.length, matches };
  },
};

export const verifyPolicy = {
  category: "intake",
  schema: {
    name: "verify_policy",
    description: "Verify a policy: active status, line of business, limit, deductible, and exclusions.",
    parameters: {
      type: "object" as const,
      properties: {
        policyId: { type: "string", description: "Policy id, e.g. POL-88102" },
      },
      required: ["policyId"],
    },
  },
  async execute({ policyId }: { policyId: string }) {
    const p = POLICIES.find((x) => x.id.toLowerCase() === policyId.toLowerCase().trim());
    return p ? { found: true, policy: p } : { found: false, note: `no policy "${policyId}" on file` };
  },
};
