import Anthropic from "@anthropic-ai/sdk";
import { SpeakingTurn, CodedTurn, CategoryDefinition, CodingScheme, ApiLog } from "@/lib/types";
import { buildSystemPrompt, buildUserMessage } from "./prompts";

const CONCURRENCY = 5;

export async function POST(request: Request) {
  const { turns, model, categories, rules, contextWindow = 5, apiKey: clientKey } = (await request.json()) as {
    turns: SpeakingTurn[];
    model: string;
    categories: CategoryDefinition[];
    rules?: string;
    contextWindow?: number;
    apiKey?: string;
  };

  const apiKey = clientKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    return new Response(
      JSON.stringify({ error: "No API key provided. Enter your Anthropic API key in Step 1." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!turns || !Array.isArray(turns) || turns.length === 0) {
    return new Response(
      JSON.stringify({ error: "No turns provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!categories || !Array.isArray(categories) || categories.length < 2) {
    return new Response(
      JSON.stringify({ error: "At least 2 categories are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const scheme: CodingScheme = {
    id: "runtime",
    label: "",
    description: "",
    categories,
    rules: rules || undefined,
  };

  const validCategoryNames = new Set(scheme.categories.map((c) => c.name));

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(scheme);

  const tool: Anthropic.Tool = {
    name: "code_exchange",
    description: "Categorize a speaking turn and provide a rationale.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: scheme.categories.map((c) => c.name),
        },
        rationale: { type: "string" },
      },
      required: ["category", "rationale"],
    },
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let completed = 0;
        const total = turns.length;

        async function processTurn(turn: SpeakingTurn): Promise<{ codedTurn: CodedTurn; logs: ApiLog[] }> {
          const contextStart = Math.max(0, turn.turnNumber - 1 - contextWindow);
          const contextEnd = turn.turnNumber - 1;
          const contextTurns = turns.slice(contextStart, contextEnd);

          const userMessage = buildUserMessage(contextTurns, turn);
          const turnLogs: ApiLog[] = [];

          const MAX_RETRIES = 2;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const message = await client.messages.create({
              model,
              max_tokens: 300,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              tools: [tool],
              tool_choice: { type: "tool", name: "code_exchange" },
            });

            const toolBlock = message.content.find(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            const input = toolBlock?.input as { category: string; rationale: string } | undefined;

            turnLogs.push({
              turnNumber: turn.turnNumber,
              speaker: turn.speaker,
              model,
              systemPrompt,
              userMessage,
              toolDefinition: tool,
              rawResponse: message,
              parsedCategory: input?.category ?? "N/A",
              parsedRationale: input?.rationale ?? "N/A",
              attempt,
              timestamp: new Date().toISOString(),
            });

            if (toolBlock && input && validCategoryNames.has(input.category)) {
              return { codedTurn: { ...turn, category: input.category, rationale: input.rationale }, logs: turnLogs };
            }
          }

          return { codedTurn: { ...turn, category: "error", rationale: "Failed to parse model response" }, logs: turnLogs };
        }

        // Process with concurrency pool
        let index = 0;

        async function runNext(): Promise<void> {
          while (index < total) {
            const currentIndex = index++;
            const { codedTurn, logs } = await processTurn(turns[currentIndex]);

            completed++;
            controller.enqueue(
              encoder.encode(`event: result\ndata: ${JSON.stringify({ codedTurn })}\n\n`)
            );
            for (const log of logs) {
              controller.enqueue(
                encoder.encode(`event: log\ndata: ${JSON.stringify(log)}\n\n`)
              );
            }
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: ${JSON.stringify({ completed, total })}\n\n`
              )
            );
          }
        }

        const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => runNext());
        await Promise.all(workers);

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
