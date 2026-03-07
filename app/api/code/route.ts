import Anthropic from "@anthropic-ai/sdk";
import { SpeakingTurn, CodedTurn, CategoryDefinition } from "@/lib/types";
import { buildSystemPrompt, buildUserMessage } from "./prompts";

const CONCURRENCY = 5;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { turns, model, categories, contextWindow = 5 } = (await request.json()) as {
    turns: SpeakingTurn[];
    model: string;
    categories: CategoryDefinition[];
    contextWindow?: number;
  };

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

  const validCategoryNames = new Set(categories.map((c) => c.name));

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(categories);

  const tool: Anthropic.Tool = {
    name: "code_exchange",
    description: "Categorize a speaking turn and provide a rationale.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: categories.map((c) => c.name),
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

        async function processTurn(turn: SpeakingTurn): Promise<CodedTurn> {
          const contextStart = Math.max(0, turn.turnNumber - 1 - contextWindow);
          const contextEnd = turn.turnNumber - 1;
          const contextTurns = turns.slice(contextStart, contextEnd);

          const userMessage = buildUserMessage(contextTurns, turn);

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

          if (toolBlock) {
            const input = toolBlock.input as { category: string; rationale: string };
            if (validCategoryNames.has(input.category)) {
              return { ...turn, category: input.category, rationale: input.rationale };
            }
          }

          return { ...turn, category: "error", rationale: "Failed to parse model response" };
        }

        // Process with concurrency pool
        let index = 0;

        async function runNext(): Promise<void> {
          while (index < total) {
            const currentIndex = index++;
            const codedTurn = await processTurn(turns[currentIndex]);

            completed++;
            controller.enqueue(
              encoder.encode(`event: result\ndata: ${JSON.stringify({ codedTurn })}\n\n`)
            );
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
