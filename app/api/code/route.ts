import Anthropic from "@anthropic-ai/sdk";
import { SpeakingTurn, CodedTurn } from "@/lib/types";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { turns, model, threshold = 50 } = (await request.json()) as {
    turns: SpeakingTurn[];
    model: string;
    threshold?: number;
  };

  if (!turns || !Array.isArray(turns) || turns.length === 0) {
    return new Response(
      JSON.stringify({ error: "No turns provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new Anthropic({ apiKey });
  const batchSize = 5;
  const batches: SpeakingTurn[][] = [];
  for (let i = 0; i < turns.length; i += batchSize) {
    batches.push(turns.slice(i, i + batchSize));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let completed = 0;

        for (const batch of batches) {
          const turnsDescription = batch
            .map(
              (t) =>
                `Turn ${t.turnNumber}: Speaker="${t.speaker}", WordCount=${t.wordCount}, Text="${t.text}"`
            )
            .join("\n");

          const message = await client.messages.create({
            model,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `You are a conversation coding assistant. For each speaking turn below, categorize it as either "Long Turn (>${threshold} words)" if wordCount > ${threshold}, or "Short Turn (<=${threshold} words)" if wordCount <= ${threshold}.

Return ONLY a JSON array of objects with "turnNumber" (number) and "category" (string). No other text.

${turnsDescription}`,
              },
            ],
          });

          const content = message.content[0];
          if (content.type !== "text") throw new Error("Unexpected response type");

          let categories: { turnNumber: number; category: string }[];
          try {
            categories = JSON.parse(content.text);
          } catch {
            const match = content.text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error("Could not parse model response");
            categories = JSON.parse(match[0]);
          }

          const codedTurns: CodedTurn[] = batch.map((turn) => {
            const cat = categories.find((c) => c.turnNumber === turn.turnNumber);
            return {
              ...turn,
              category: cat?.category ?? (turn.wordCount > threshold ? `Long Turn (>${threshold} words)` : `Short Turn (<=${threshold} words)`),
            };
          });

          completed += batch.length;

          controller.enqueue(
            encoder.encode(`event: batch\ndata: ${JSON.stringify({ codedTurns })}\n\n`)
          );
          controller.enqueue(
            encoder.encode(
              `event: progress\ndata: ${JSON.stringify({ completed, total: turns.length })}\n\n`
            )
          );
        }

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
