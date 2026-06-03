import Anthropic from "@anthropic-ai/sdk";
import type { StructuredCallParams, StructuredCallResult } from "./types";

/**
 * Anthropic Messages API with a forced tool call. This is the original wiring
 * that lived inline in the route, moved here behind the common interface.
 */
export async function runAnthropic(
  p: StructuredCallParams,
): Promise<StructuredCallResult> {
  const client = new Anthropic({ apiKey: p.apiKey });
  const t0 = Date.now();
  console.log(
    `[llm:anthropic] → ${p.model} max_tokens=${p.maxTokens} ` +
      `systemChars=${p.system.length} userChars=${p.user.length} tool=${p.tool.name}`,
  );

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: p.model,
      max_tokens: p.maxTokens,
      // The system prompt and tools are identical for every unit in a run, so we
      // cache that prefix: a cache_control breakpoint on the system block caches
      // everything before+including it (tools → system), making each subsequent
      // call's prefix a ~10x-cheaper cache read. Only the per-unit user message
      // (below) is uncached. Usage buckets are read back in lib/usage.ts.
      system: [{ type: "text", text: p.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: p.user }],
      tools: [
        {
          name: p.tool.name,
          description: p.tool.description,
          input_schema: p.tool.input_schema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: p.tool.name },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    console.error(
      `[llm:anthropic] ✗ ${p.model} failed after ${Date.now() - t0}ms` +
        `${status !== undefined ? ` (status ${status})` : ""}:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  console.log(
    `[llm:anthropic] ✓ ${p.model} in ${Date.now() - t0}ms ` +
      `stop=${message.stop_reason} toolUse=${!!toolBlock} ` +
      `usage(in/out/cacheR/cacheW)=${message.usage.input_tokens}/` +
      `${message.usage.output_tokens}/` +
      `${message.usage.cache_read_input_tokens ?? 0}/` +
      `${message.usage.cache_creation_input_tokens ?? 0}`,
  );
  return { input: toolBlock?.input, raw: message };
}
