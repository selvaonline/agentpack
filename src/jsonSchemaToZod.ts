// agentpack — convert a tool's JSON-Schema parameters block to zod (the
// subset of JSON Schema tools use: string/number/boolean/array/object).
import { z, ZodTypeAny } from "zod";

export function jsonSchemaToZod(params: any): z.ZodObject<any> {
  const props = params?.properties || {};
  const required: string[] = params?.required || [];
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, raw] of Object.entries<any>(props)) {
    let t = typeFor(raw);
    if (raw.description) t = t.describe(raw.description);
    // LLMs send explicit nulls for optional params; accept and strip later.
    shape[key] = required.includes(key) ? t : t.nullable().optional();
  }
  return z.object(shape);
}

function typeFor(prop: any): ZodTypeAny {
  switch (prop?.type) {
    case "string":
      return prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(prop.items ? typeFor(prop.items) : z.any());
    case "object": {
      if (prop.properties) return jsonSchemaToZod(prop);
      return z.record(z.any());
    }
    default:
      return z.any();
  }
}
