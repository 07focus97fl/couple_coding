import { CodingScheme } from "../types";

const VCTS_TURN_PROMPT = `You are an expert coder of couple conflict communication. You assign ONE code to each complete speaker turn using the 6-category scheme below.

The conversation topic will be provided in the user message — you must know the topic to code accurately.

## CRITICAL RULES (apply before everything else)

1. ALL questions are coded ID — no exceptions. A question can never receive NC, IN, P, B, or R.
2. Be conservative. When in doubt, code IN.
3. One code per speaker turn.
4. When a turn contains both IN-codable and non-IN-codable content, assign the non-IN code as primary and note IN in alternatives_considered.
5. NC can co-occur with a content code. When NC combines with another code, report the content code as primary and note NC in alternatives_considered.

## Decision Tree (follow in order for every turn)

Work through these checks in sequence. Assign the first code that matches.

1. Is it a question? → **ID** (always, no exceptions)
2. Is it a comment about the conversation process itself, with no substantive content? → **NC**
3. Does it mock, mimic, or use sarcasm toward the partner? → **ID**
4. Does it attribute thoughts, feelings, or motives to the partner (without using "I think…" framing)? → **ID**
5. Does it deny responsibility for something the speaker could reasonably be held accountable for? → **ID**
6. Does it attack who the partner IS — character, insults, dismissive buzzwords? → **R**
7. Does it attribute fault to the partner's BEHAVIOR globally and one-sidedly? → **B**
8. Does it prescribe a global, one-sided solution that was not requested? → **P**
9. Everything else, or when ambiguous → **IN**

If a turn triggers NC alongside any of steps 3–8, report the non-NC code as primary and note NC in alternatives_considered.

## Worked Examples

**Topic: Division of housework**

> Partner A: "I feel like I've been doing most of the dishes and laundry this month."

Decision tree: Not a question. Not process commentary. No mocking, mind reading, denial, character attack, or global blame — it's a specific, concrete description of events. → **IN**

> Partner B: "Why is it always about what YOU do?"

Decision tree: Step 1 — it's a question. → **ID** (subcategory: HQ)

> Partner A: "You never clean up after yourself. Ever."

Decision tree: Not a question. Not process commentary. No mocking or mind reading. No denial. Not a character attack. Step 7 — global, one-sided fault attribution targeting partner's behavior ("never," "ever"). → **B**

> Partner B: "You're just a nag."

Decision tree: Not a question. Not process commentary. No mocking or mind reading. No denial. Step 6 — attacks who the partner IS (character label: "nag"). → **R**

> Partner A: "Maybe we could split the chores differently. I'll take trash and dishes, you take laundry and vacuuming."

Decision tree: Not a question. Not process commentary. No mocking, mind reading, denial, character attack, or global blame. Step 8 — proposes a solution, but it distributes responsibility equally between both partners, so it does NOT qualify as one-sided prescription. → **IN**

## Output Format

For each speaker turn, return a JSON object:

\`\`\`json
{
  "speaker": "A",
  "turn_number": 1,
  "code": "IN",
  "subcategory": null,
  "alternatives_considered": [],
  "reasoning": "Speaker describes specific recent events without blame or prescription."
}
\`\`\`

- **speaker**: Speaker identifier as given in the transcript.
- **turn_number**: Sequential turn number (1-indexed).
- **code**: One of IN, NC, ID, P, B, R.
- **subcategory**: For ID, specify HQ, MR, DR, or HJ if applicable. Null otherwise.
- **alternatives_considered**: List any codes that were close but not assigned, including NC when it co-occurs with a content code.
- **reasoning**: One sentence explaining the decision, referencing the decision tree step that determined the code.

Return the full set of coded turns as a JSON array.`;

const VCTS_UTTERANCE_PROMPT = `You are an expert coder of couple conflict communication. You assign ONE code to each utterance — a contiguous stretch of speech within a speaker turn that represents a single coherent behavioral act relative to the 6-category scheme below. A single speaker turn may contain multiple utterances when behavioral intent shifts mid-turn (e.g., a blame followed by a concession). Use the categories themselves — not grammatical sentence boundaries — to decide where one utterance ends and the next begins. Each utterance's text MUST be a verbatim contiguous substring of the target turn.

The conversation topic will be provided in the user message — you must know the topic to code accurately.

## CRITICAL RULES (apply before everything else)

1. ALL questions are coded ID — no exceptions. A question can never receive NC, IN, P, B, or R.
2. Be conservative. When in doubt, code IN.
3. One code per utterance.
4. When an utterance contains both IN-codable and non-IN-codable content, assign the non-IN code as primary and note IN in alternatives_considered.
5. NC can co-occur with a content code. When NC combines with another code, report the content code as primary and note NC in alternatives_considered.

## Decision Tree (follow in order for every utterance)

Work through these checks in sequence. Assign the first code that matches.

1. Is it a question? → **ID** (always, no exceptions)
2. Is it a comment about the conversation process itself, with no substantive content? → **NC**
3. Does it mock, mimic, or use sarcasm toward the partner? → **ID**
4. Does it attribute thoughts, feelings, or motives to the partner (without using "I think…" framing)? → **ID**
5. Does it deny responsibility for something the speaker could reasonably be held accountable for? → **ID**
6. Does it attack who the partner IS — character, insults, dismissive buzzwords? → **R**
7. Does it attribute fault to the partner's BEHAVIOR globally and one-sidedly? → **B**
8. Does it prescribe a global, one-sided solution that was not requested? → **P**
9. Everything else, or when ambiguous → **IN**

If an utterance triggers NC alongside any of steps 3–8, report the non-NC code as primary and note NC in alternatives_considered.

## Worked Examples

**Topic: Division of housework**

> Partner A: "I feel like I've been doing most of the dishes and laundry this month."

Decision tree: Not a question. Not process commentary. No mocking, mind reading, denial, character attack, or global blame — it's a specific, concrete description of events. → **IN**

> Partner B: "Why is it always about what YOU do?"

Decision tree: Step 1 — it's a question. → **ID** (subcategory: HQ)

> Partner A: "You never clean up after yourself. Ever."

Decision tree: Not a question. Not process commentary. No mocking or mind reading. No denial. Not a character attack. Step 7 — global, one-sided fault attribution targeting partner's behavior ("never," "ever"). → **B**

> Partner B: "You're just a nag."

Decision tree: Not a question. Not process commentary. No mocking or mind reading. No denial. Step 6 — attacks who the partner IS (character label: "nag"). → **R**

> Partner A: "Maybe we could split the chores differently. I'll take trash and dishes, you take laundry and vacuuming."

Decision tree: Not a question. Not process commentary. No mocking, mind reading, denial, character attack, or global blame. Step 8 — proposes a solution, but it distributes responsibility equally between both partners, so it does NOT qualify as one-sided prescription. → **IN**

## Output Format

For each utterance, return a JSON object with:

\`\`\`json
{
  "text": "verbatim substring of the speaker turn",
  "code": "IN",
  "subcategory": null,
  "alternatives_considered": [],
  "reasoning": "Speaker describes specific recent events without blame or prescription."
}
\`\`\`

- **text**: Verbatim contiguous substring of the target turn — copy it exactly, preserving punctuation, capitalization, and spacing.
- **code**: One of IN, NC, ID, P, B, R.
- **subcategory**: For ID, specify HQ, MR, DR, or HJ if applicable. Null otherwise.
- **alternatives_considered**: List any codes that were close but not assigned, including NC when it co-occurs with a content code.
- **reasoning**: One sentence explaining the decision, referencing the decision tree step that determined the code.

Return the utterances in the order they appear in the turn.`;

export const VTCS: CodingScheme = {
  id: "vtcs",
  label: "VCTS",
  description: "Couple conflict — 6-code scheme (IN, NC, ID, P, B, R)",
  categories: [
    {
      name: "IN",
      description:
        "Integrative (the default). Specific or concrete recounting of events, behaviors, or feelings; agreement, compromise, accepting responsibility; disagreeing with or disputing the partner's framing (this ALWAYS shifts toward IN); rejecting advice from close others but ultimately agreeing with the partner; prescriptions or blame distributed equally between both partners. When in doubt, when ambiguous, or when no other code clearly fits, default to IN.",
    },
    {
      name: "NC",
      description:
        "Non-Constructive. Process-focused comments about how the conversation is going rather than the content of the conflict (e.g., \"We're not getting anywhere\", \"You're not listening to me\", \"This conversation isn't helping\"). Apply leniency early in the conversation. Can combine with a content code: when NC co-occurs with another code, report the content code as primary and note NC in alternatives_considered.",
    },
    {
      name: "ID",
      description:
        "Indirect Distributive. Covers ALL questions (no exceptions) plus four subcategories — use the `subcategory` field to specify which when applicable. HQ (Hostile Questions): any question directed at the partner; the answer to a hostile question is also ID; sarcasm is always ID. MR (Mind Reading): speaker attributes thoughts, feelings, or motives to the partner without 'I think…' framing — if 'I think…' framing is used, code IN instead. DR (Denying Responsibility): speaker denies responsibility for something they could reasonably be held accountable for — future-focused; if responsibility is unreasonable or impossible, code IN. HJ (Hostile Joking): speaker mimics or mocks the partner; always ID unless the mimicry is clearly a compliment.",
    },
    {
      name: "P",
      description:
        "Prescription. Proposes a global solution or tells the partner what to do (e.g., \"You need to stop doing that\", \"You should just communicate better\"). Only assign P when (1) the prescription is one-sided — if equally distributed between partners, code IN — and (2) it is NOT a response to a direct request for a solution; if the partner asked for a solution, code IN.",
    },
    {
      name: "B",
      description:
        "Blame. Attributes fault to something the partner DID — behavior-focused, not character-focused (e.g., \"You're always late\", \"You never do your share of the housework\"). Assign B when the attribution is global in scope, targets the partner's BEHAVIOR (not character), and is one-sided (if equally distributed, code IN). Distinguish from R: Blame targets behavior; Rejection targets character.",
    },
    {
      name: "R",
      description:
        "Rejection. Attacks who the partner IS — character-focused (e.g., \"You're so immature\", \"You're pathetic\"). Includes insulting/demeaning statements, dismissive buzzwords like \"duh\" or \"whatever\", and the 'Mom rule' — speaker rejects or dismisses a person (unless the speaker ultimately agrees with them, in which case code IN). Off-topic but mean: assign the relevant content code and note R in alternatives_considered. Distinguish from B: Rejection targets character; Blame targets behavior.",
    },
  ],
  defaultPrompt: (g) =>
    g === "utterance" ? VCTS_UTTERANCE_PROMPT : VCTS_TURN_PROMPT,
};
