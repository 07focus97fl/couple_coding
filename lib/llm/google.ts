import {
  GoogleGenAI,
  Type,
  FunctionCallingConfigMode,
  type Schema,
} from "@google/genai";
import type { StructuredCallParams, StructuredCallResult } from "./types";

function jsonTypeToGemini(t: string): Type {
  switch (t) {
    case "object":
      return Type.OBJECT;
    case "array":
      return Type.ARRAY;
    case "number":
      return Type.NUMBER;
    case "integer":
      return Type.INTEGER;
    case "boolean":
      return Type.BOOLEAN;
    default:
      return Type.STRING;
  }
}

/**
 * Translate the provider-neutral JSON Schema into a Gemini `Schema`: uppercase
 * `Type` enums, `["string","null"]` → base type + `nullable: true`, and drop
 * keywords Gemini doesn't model (additionalProperties, minItems). The forced
 * `mode: ANY` already guarantees at least one item, so minItems is cosmetic.
 */
function toGeminiSchema(node: Record<string, unknown>): Schema {
  const out: Record<string, unknown> = {};

  const rawType = node.type;
  let typeStr: string | undefined;
  if (Array.isArray(rawType)) {
    const concrete = rawType.filter((t) => t !== "null");
    if (rawType.includes("null")) out.nullable = true;
    typeStr = concrete[0] as string | undefined;
  } else if (typeof rawType === "string") {
    typeStr = rawType;
  }
  if (typeStr) out.type = jsonTypeToGemini(typeStr);

  if (typeof node.description === "string") out.description = node.description;
  if (Array.isArray(node.enum)) out.enum = node.enum as string[];
  if (typeof node.minimum === "number") out.minimum = node.minimum;
  if (typeof node.maximum === "number") out.maximum = node.maximum;
  if (Array.isArray(node.required)) out.required = node.required as string[];

  if (node.properties && typeof node.properties === "object") {
    const props: Record<string, Schema> = {};
    for (const [key, val] of Object.entries(
      node.properties as Record<string, unknown>,
    )) {
      props[key] = toGeminiSchema(val as Record<string, unknown>);
    }
    out.properties = props;
  }
  if (node.items && typeof node.items === "object") {
    out.items = toGeminiSchema(node.items as Record<string, unknown>);
  }

  return out as Schema;
}

/**
 * Gemini (@google/genai) with forced function calling (`mode: ANY` restricted to
 * the single tool). `response.functionCalls[0].args` is already a parsed object.
 */
export async function runGoogle(
  p: StructuredCallParams,
): Promise<StructuredCallResult> {
  const ai = new GoogleGenAI({ apiKey: p.apiKey });
  const response = await ai.models.generateContent({
    model: p.model,
    contents: p.user,
    config: {
      systemInstruction: p.system,
      // Gemini 3.x "thinks" before answering; keep headroom so the forced
      // function call isn't truncated (a cap, billed on actual output).
      maxOutputTokens: Math.max(p.maxTokens, 2048),
      tools: [
        {
          functionDeclarations: [
            {
              name: p.tool.name,
              description: p.tool.description,
              parameters: toGeminiSchema(p.tool.input_schema),
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [p.tool.name],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];
  return { input: call?.args, raw: response };
}
