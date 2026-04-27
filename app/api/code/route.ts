import Anthropic from "@anthropic-ai/sdk";
import {
  SpeakingTurn,
  CodedUnit,
  CategoryDefinition,
  ApiLog,
  ApiLogParsedUnit,
  Granularity,
} from "@/lib/types";
import { buildSystemPrompt, buildUserMessage } from "./prompts";

const CONCURRENCY = 5;

interface CodeRequest {
  turns: SpeakingTurn[];
  model: string;
  granularity: Granularity;
  categories: CategoryDefinition[];
  systemPrompt: string;
  contextWindow?: number;
  apiKey?: string;
}

interface TurnModeInput {
  category: string;
  rationale: string;
}

interface UtteranceInputEntry {
  text: string;
  category: string;
  rationale: string;
}

interface UtteranceModeInput {
  utterances: UtteranceInputEntry[];
}

export async function POST(request: Request) {
  const {
    turns,
    model,
    granularity,
    categories,
    systemPrompt: rawPrompt,
    contextWindow = 5,
    apiKey: clientKey,
  } = (await request.json()) as CodeRequest;

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

  if (!categories || !Array.isArray(categories) || categories.filter((c) => c.name.trim() !== "").length < 2) {
    return new Response(
      JSON.stringify({ error: "At least 2 categories are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "System prompt is empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const activeGranularity: Granularity = granularity === "utterance" ? "utterance" : "turn";
  const validCategoryNames = new Set(
    categories.filter((c) => c.name.trim() !== "").map((c) => c.name)
  );
  const categoryEnum = Array.from(validCategoryNames);

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(rawPrompt, categories);

  const tool: Anthropic.Tool =
    activeGranularity === "turn"
      ? {
          name: "code_exchange",
          description: "Categorize a speaking turn and provide a rationale.",
          input_schema: {
            type: "object" as const,
            properties: {
              category: { type: "string", enum: categoryEnum },
              rationale: { type: "string" },
            },
            required: ["category", "rationale"],
          },
        }
      : {
          name: "code_exchange",
          description:
            "Segment a speaking turn into one or more coded utterances. Each utterance must quote a verbatim contiguous substring of the target turn.",
          input_schema: {
            type: "object" as const,
            properties: {
              utterances: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "Verbatim contiguous substring of the target turn.",
                    },
                    category: { type: "string", enum: categoryEnum },
                    rationale: { type: "string" },
                  },
                  required: ["text", "category", "rationale"],
                },
              },
            },
            required: ["utterances"],
          },
        };

  const maxTokens = activeGranularity === "turn" ? 300 : 2000;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let completed = 0;
        const total = turns.length;

        async function processTurn(
          turn: SpeakingTurn
        ): Promise<{ codedUnits: CodedUnit[]; log: ApiLog }> {
          const contextStart = Math.max(0, turn.turnNumber - 1 - contextWindow);
          const contextEnd = turn.turnNumber - 1;
          const contextTurns = turns.slice(contextStart, contextEnd);

          const userMessage = buildUserMessage(contextTurns, turn);

          const MAX_RETRIES = 2;
          let lastResponse: Anthropic.Message | null = null;
          let lastParsedUnits: ApiLogParsedUnit[] = [];
          let lastAttempt = 0;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            lastAttempt = attempt;
            const message = await client.messages.create({
              model,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              tools: [tool],
              tool_choice: { type: "tool", name: "code_exchange" },
            });
            lastResponse = message;

            const toolBlock = message.content.find(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );
            const input = toolBlock?.input;

            if (activeGranularity === "turn") {
              const parsed = input as TurnModeInput | undefined;
              if (
                parsed &&
                typeof parsed.category === "string" &&
                typeof parsed.rationale === "string" &&
                validCategoryNames.has(parsed.category)
              ) {
                const unit: CodedUnit = {
                  unitId: `T${turn.turnNumber}`,
                  turnNumber: turn.turnNumber,
                  speaker: turn.speaker,
                  text: turn.text,
                  startTime: turn.startTime,
                  endTime: turn.endTime,
                  wordCount: turn.wordCount,
                  category: parsed.category,
                  rationale: parsed.rationale,
                };
                lastParsedUnits = [
                  { unitId: unit.unitId, category: parsed.category, rationale: parsed.rationale },
                ];
                return {
                  codedUnits: [unit],
                  log: {
                    turnNumber: turn.turnNumber,
                    speaker: turn.speaker,
                    granularity: activeGranularity,
                    unitIds: [unit.unitId],
                    model,
                    systemPrompt,
                    userMessage,
                    toolDefinition: tool,
                    rawResponse: message,
                    parsedUnits: lastParsedUnits,
                    attempt,
                    timestamp: new Date().toISOString(),
                  },
                };
              }
            } else {
              const parsed = input as UtteranceModeInput | undefined;
              const list = parsed?.utterances;
              if (
                Array.isArray(list) &&
                list.length > 0 &&
                list.every(
                  (u) =>
                    u &&
                    typeof u.text === "string" &&
                    u.text.trim().length > 0 &&
                    typeof u.category === "string" &&
                    validCategoryNames.has(u.category) &&
                    typeof u.rationale === "string"
                )
              ) {
                const units: CodedUnit[] = list.map((u, i) => {
                  const utteranceIndex = i + 1;
                  const unitId = `T${turn.turnNumber}.U${utteranceIndex}`;
                  return {
                    unitId,
                    turnNumber: turn.turnNumber,
                    utteranceIndex,
                    speaker: turn.speaker,
                    text: u.text,
                    startTime: turn.startTime,
                    endTime: turn.endTime,
                    wordCount: u.text.trim().split(/\s+/).length,
                    category: u.category,
                    rationale: u.rationale,
                  };
                });
                lastParsedUnits = units.map((u) => ({
                  unitId: u.unitId,
                  category: u.category,
                  rationale: u.rationale,
                  text: u.text,
                }));
                return {
                  codedUnits: units,
                  log: {
                    turnNumber: turn.turnNumber,
                    speaker: turn.speaker,
                    granularity: activeGranularity,
                    unitIds: units.map((u) => u.unitId),
                    model,
                    systemPrompt,
                    userMessage,
                    toolDefinition: tool,
                    rawResponse: message,
                    parsedUnits: lastParsedUnits,
                    attempt,
                    timestamp: new Date().toISOString(),
                  },
                };
              }
            }
          }

          const errorUnit: CodedUnit = {
            unitId: `T${turn.turnNumber}`,
            turnNumber: turn.turnNumber,
            speaker: turn.speaker,
            text: turn.text,
            startTime: turn.startTime,
            endTime: turn.endTime,
            wordCount: turn.wordCount,
            category: "error",
            rationale: "Failed to parse model response",
          };
          return {
            codedUnits: [errorUnit],
            log: {
              turnNumber: turn.turnNumber,
              speaker: turn.speaker,
              granularity: activeGranularity,
              unitIds: [errorUnit.unitId],
              model,
              systemPrompt,
              userMessage,
              toolDefinition: tool,
              rawResponse: lastResponse ?? {},
              parsedUnits: lastParsedUnits,
              attempt: lastAttempt,
              timestamp: new Date().toISOString(),
            },
          };
        }

        let index = 0;

        async function runNext(): Promise<void> {
          while (index < total) {
            const currentIndex = index++;
            const { codedUnits, log } = await processTurn(turns[currentIndex]);

            for (const unit of codedUnits) {
              controller.enqueue(
                encoder.encode(
                  `event: result\ndata: ${JSON.stringify({ codedUnit: unit, codedTurn: unit })}\n\n`
                )
              );
            }

            controller.enqueue(
              encoder.encode(`event: log\ndata: ${JSON.stringify(log)}\n\n`)
            );

            completed++;
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
