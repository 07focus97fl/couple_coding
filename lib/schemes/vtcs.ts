/**
 * WHAT:    The VTCS scheme: six couple-conflict codes (IN, NC, ID, P, B, R). The
 *          turn and utterance prompts share one hand-written body (vtcsRules) and
 *          differ only in their opener, one critical rule and their output format,
 *          so the two cannot drift. Continuous-rating and time-window runs fall
 *          back to the generic default prompt.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "./default-prompt";

/**
 * The rules every VTCS categorical run shares: critical rules, the decision tree
 * and the worked examples. Turn and utterance mode differ only in the word used
 * for the unit being coded and in how a multi-statement turn is handled, so the
 * unit is the single parameter.
 */
function vtcsRules(unit: "turn" | "utterance"): string {
  const one = unit === "turn" ? "speaker turn" : "utterance";
  const a = unit === "turn" ? "a turn" : "an utterance";
  const A = a.charAt(0).toUpperCase() + a.slice(1);
  const multiStatement =
    unit === "turn"
      ? "A speaking turn may contain several distributive statements. Assign only one code: report the highest-precedence one as primary (P/B/R over ID) and list the others in alternatives_considered."
      : "A speaking turn may contain several distributive statements, and only ONE code belongs to each statement. Segment the turn so that each statement is its own utterance rather than merging them.";

  return `## CRITICAL RULES (apply before everything else)

1. A question is never NC, B, or P. A question CAN be R — if it rejects the partner or their idea outright ("Who cares?"), code R. Otherwise, hostile, challenging, or indirect (mind-reading framing) questions are ID, and neutral, logistical, or affiliative questions are IN.
2. Ask yourself, "What is the goal of the statement?" Be conservative when assigning non-IN codes. When in doubt, code IN.
3. One code per ${one}. ${multiStatement}
4. Precedence: every distributive code (P, B, R, ID) overrides IN, and P, B and R override ID for a single statement. When ${a} contains both IN-codable and non-IN-codable content, assign the non-IN code as primary and note IN in alternatives_considered. When it qualifies for both an ID subcategory and P, B or R, assign the P, B or R code as primary and note ID in alternatives_considered.
5. NC can co-occur with a content code. When NC combines with another code, report the content code as primary and note NC in alternatives_considered.
6. Mom Rule: distributive behavior aimed at a third party — a parent, in-law, or friend — still counts as distributive, and this applies to ALL of P, B, R and ID. The exception is when the partner is on the same general page about that person, in which case code IN.

## Decision Tree (follow in order for every ${unit})

Work through these checks in sequence. Assign the first code that matches.

1. Is it a question? → A question is never NC, B, or P. If it rejects the partner or their idea outright, it is **R** (step 3). Otherwise, hostile, challenging, or indirect (mind-reading framing) questions are **ID**, and neutral, logistical, or affiliative questions are **IN**.
   "Yeah? You could." → IN (welcoming, not hostile)
   "Wait, can we talk about those questions now?" → IN (logistical, neutral)
   "Does that make you feel anxious, though?" → IN (genuine inquiry, not hostile)
   "Why is it always about what YOU do?" → ID (criticism framed as a question)
   "Who cares?" → R (rejects the partner's point of view outright, rather than probing it)
2. Is it off topic — not addressing the conversation topic given in the user message — or a comment about how this conversation is going right now, with no substantive content? → **NC**
   Includes off-topic talk about the study setup itself (cameras, researchers, instructions, monitoring): "They said they can see us live." → NC. "It's possible. They still won't know until afterwards." → NC.
   Includes responses that merely react to the partner's process commentary with no independent substantive content: [S1: "This feels really awkward." → NC] [S2: "No, I don't think so." → NC]
   ${A} that starts on topic but ENDS off topic is NC. An abrupt shift to something irrelevant is NC; a shift that is still relevant in some way is topic drift, and topic drift is not NC.
   Does NOT include remarks about the conversation's history or recurring relational patterns — "We've had this discussion before" or "We never reach a solution to this" are **IN**.
3. Does it attack who the partner IS — character, insults, dismissive buzzwords — or reject their idea or point of view, more than just disagreeing with it? → **R**
   Must be direct and definitive. Insults toward the partner's loved ones count.
   Still an R when asked or prompted. Saying "we" does NOT get someone out of an R, insulting oneself as part of the R does not either, and backing the R up with behaviors is still an R.
4. Does it attribute fault to the partner's BEHAVIOR globally and one-sidedly? → **B**
   The flaw must be general rather than a specific instance — if the claim could be time-stamped to one occasion, it is not B. Must be direct. Not a blame if the partner asked. Saying "we" CAN get someone out of a Blame.
   Softening language does not soften the code — if the underlying attribution of fault is present, "sometimes" or "kind of" still leaves it B: "Okay. Then sometimes you do [make me feel anxious]." → B
   B or R? Is the action in the partner's **behavior** (B) or in **possessing a quality** (R)?
5. Does it prescribe a global, one-sided solution that was not requested? → **P**
   Must be direct. Not a P if it is framed as "we", if responsibility is distributed equally ("You need to ___ and I need to ___"), or if it is specific to this moment, for this conversation.
6. Does it mock, mimic, or use sarcasm toward the partner? → **ID** (HJ; use SAR when the speaker says the opposite of what they mean)
7. Does it attribute thoughts, feelings, or motives to the partner, or predict what they will think or feel (without using "I think…" framing)? → **ID** (MR)
   Includes quoting or imitating the partner's words, narrating the partner's speech acts, or predicting how the partner will react or feel — even when the recounting is specific and contextualized.
   "Whenever I ask you, you're like, 'You do whatever you want.'" → ID
   "She's gonna be like really pissed off at me when I get home." → ID
   "She goes, 'Why are you in such a rush to get outta bed?'" → ID
   "That's only if you're like, 'I'll be home in an hour.' And then four hours later..." → ID
   Where it is genuinely unclear whether an attribution is a mind read, it is MR when the attribution is inaccurate — the partner might disagree with it, or it could not possibly be correct. It cannot be MR if the partner asked.
8. Does it deny responsibility for something the speaker could reasonably be held accountable for? → **ID** (DR)
   A defensive, present- or future-focused excuse, where the speaker has a legitimate responsibility and offers an illegitimate excuse. If the responsibility is unreasonable or impossible, code IN.
9. Does it make a claim that could not possibly be true — "always", "everything" — in order to undermine the partner or their idea? → **ID** (EX)
   Distinguish from B: a B is a global but credible attribution of fault for the partner's behavior; an EX is a sweeping claim that cannot literally be true, used to undermine.
10. Everything else, or when ambiguous → **IN**

If ${a} triggers NC alongside any of steps 3–9, report the non-NC code as primary and note NC in alternatives_considered.

## Worked Examples

**Topic: Division of housework**

> Partner A: "I feel like I've been doing most of the dishes and laundry this month."

Decision tree: Not a question. On topic. No character attack, global blame, prescription, mocking, mind reading, denial, or exaggeration — it is a specific, concrete disclosure about the speaker. → **IN**

> Partner B: "Why is it always about what YOU do?"

Decision tree: Step 1 — a question. It does not reject the partner outright, and it is hostile: a criticism framed as a question. → **ID** (subcategory: HQ)

> Partner A: "You never clean up after yourself. Ever."

Decision tree: Not a question. On topic. Not a character attack. Step 4 — global, one-sided fault attribution targeting the partner's behavior ("never," "ever"), and it cannot be time-stamped to one occasion. → **B**

> Partner B: "You're just a nag."

Decision tree: Not a question. On topic. Step 3 — attacks who the partner IS (character label: "nag"). → **R**

> Partner B: "Who cares?"

Decision tree: Step 1 — a question, but it rejects the partner's point of view outright rather than probing it, so it falls to step 3. A question can be R. → **R**

> Partner A: "We both let the dishes pile up sometimes."

Decision tree: Not a question. On topic. Not a character attack. Step 4 — the content is a global attribution of fault about behavior, but it is framed as "we", which takes it out of Blame. No other code fits. → **IN**

> Partner B: "You need to just stop worrying about it."

Decision tree: Not a question. On topic. Not a character attack, and no fault attributed to a past behavior. Step 5 — direct, one-sided, global, and not a response to a request for a solution. → **P**

> Partner A: "Maybe we could split the chores differently. I'll take trash and dishes, you take laundry and vacuuming."

Decision tree: Not a question. On topic. No character attack or global blame. Step 5 — proposes a solution, but it distributes responsibility equally between both partners, so it does NOT qualify as one-sided prescription. → **IN**

> Partner B: "You do literally everything wrong, all day, every day."

Decision tree: Not a question. On topic. Not a character attack. Step 4 is close, but the claim cannot literally be true. Step 9 — a sweeping claim used to undermine the partner. → **ID** (subcategory: EX), with B in alternatives_considered`;
}

const TURN_OPENER = `You are an expert coder of couple conflict communication. You assign ONE code to each complete speaker turn using the 6-category scheme below.

The conversation topic will be provided in the user message — you must know the topic to code accurately.`;

const UTTERANCE_OPENER = `You are an expert coder of couple conflict communication. You assign ONE code to each utterance — a contiguous stretch of speech within a speaker turn that represents a single coherent behavioral act relative to the 6-category scheme below. A single speaker turn may contain multiple utterances when behavioral intent shifts mid-turn (e.g., a blame followed by a concession). Use the categories themselves — not grammatical sentence boundaries — to decide where one utterance ends and the next begins. Each utterance's text MUST be a verbatim contiguous substring of the target turn.

The conversation topic will be provided in the user message — you must know the topic to code accurately.`;

const TURN_OUTPUT = `## Output Format

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
- **subcategory**: For ID, specify HQ, SAR, MR, DR, HJ, or EX if applicable. Null otherwise.
- **alternatives_considered**: List any codes that were close but not assigned, including NC when it co-occurs with a content code.
- **reasoning**: One sentence explaining the decision, referencing the decision tree step that determined the code.

Return the full set of coded turns as a JSON array.`;

const UTTERANCE_OUTPUT = `## Output Format

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
- **subcategory**: For ID, specify HQ, SAR, MR, DR, HJ, or EX if applicable. Null otherwise.
- **alternatives_considered**: List any codes that were close but not assigned, including NC when it co-occurs with a content code.
- **reasoning**: One sentence explaining the decision, referencing the decision tree step that determined the code.

Return the utterances in the order they appear in the turn.`;

const VTCS_TURN_PROMPT = `${TURN_OPENER}

${vtcsRules("turn")}

${TURN_OUTPUT}`;

const VTCS_UTTERANCE_PROMPT = `${UTTERANCE_OPENER}

${vtcsRules("utterance")}

${UTTERANCE_OUTPUT}`;

export const VTCS: CodingScheme = {
  id: "vtcs",
  label: "VTCS",
  description: "Couple conflict — 6-code scheme (IN, NC, ID, P, B, R)",
  categories: [
    {
      name: "IN",
      description:
        "Integrative. Specific or concrete recounting of events, behaviors, or feelings; agreement, compromise, accepting responsibility; clarifying the issue or disputing facts; disagreeing with or disputing the partner's framing (this always shifts toward IN); rejecting advice from close others but ultimately agreeing with the partner. Disclosures — where the focus of the statement is to say something about oneSELF rather than about the partner — are IN. When the speaker uses the present tense, assume they are talking about THIS conversation. The more the couple debates and is unsure, the more likely it is IN. When in doubt, when ambiguous, or when no other code clearly fits, default to IN.",
    },
    {
      name: "NC",
      description:
        "Non-Continuity. Off topic — the unit does not address the conversation topic given in the user message — including process-focused comments about how the conversation is going rather than the content of the conflict (e.g., \"We're not getting anywhere\", \"This conversation isn't helping\"). A unit that starts on topic but ENDS off topic is NC. An abrupt shift to something irrelevant is NC; a shift that is still relevant in some way is topic drift, which is not NC. Apply leniency early in the conversation. Can combine with a content code: when NC co-occurs with another code, report the content code as primary and note NC in alternatives_considered.",
    },
    {
      name: "ID",
      description:
        "Indirect Distributive. Hostility or undermining aimed at the partner indirectly — use the `subcategory` field to specify which type applies. HQ (Hostile Questions): a question that functions as a criticism or attack rather than a genuine request for information; the speaker is trying to prove themselves right, has an answer in mind, and looks for a specific response that undermines the partner. Answering one's OWN hostile question in the next speaking turn is also HQ; answering the PARTNER's hostile question is NOT. SAR (Sarcasm): saying the opposite of what one means; always ID. MR (Mind Reading): speaker attributes thoughts, feelings, or motives to the partner, or predicts what they will think or feel, without 'I think…' framing — if 'I think…' framing is used, code IN instead. Where it is genuinely unclear, it is MR when the attribution is inaccurate: the partner might disagree, or it could not possibly be correct. It cannot be MR if the partner asked. DR (Denying Responsibility): a defensive, present- or future-focused excuse for something the speaker could reasonably be held accountable for — only when the person has a legitimate responsibility and offers an illegitimate excuse; if the responsibility is unreasonable or impossible, code IN. HJ (Hostile Joking): speaker mimics or mocks the partner, or makes a joke at the partner's expense; always ID unless the mimicry is clearly a compliment. EX (Exaggerations): a claim that could not possibly be true (\"always\", \"everything\"), used to undermine the partner or their idea.",
    },
    {
      name: "P",
      description:
        "Prescription. Proposes a global solution or tells the partner what to do (e.g., \"You need to stop doing that\", \"You should just communicate better\"). Must be direct, and cannot be a question or be framed as \"we\". Only assign P when it is NOT a response to a direct request for a solution; if the partner asked for a solution, code IN. Not a P if responsibility is distributed equally (\"You need to ___ and I need to ___\"), and not a P if it is specific to this moment, for this conversation.",
    },
    {
      name: "B",
      description:
        "Blame. Attributes fault to something the partner DID — behavior-focused, not character-focused (e.g., \"You're always late\", \"You never do your share of the housework\"). The flaw must be general rather than a specific instance, so a blame cannot be time-stamped to one occasion. Must be direct, and cannot be a question. Global markers include \"you always\", \"you never\", and \"sometimes\". Not a blame if the partner asked, and saying \"we\" CAN get someone out of a Blame. Distinguish from R: is the action in the partner's behavior (B) or in possessing a quality (R)?",
    },
    {
      name: "R",
      description:
        "Rejection. Attacks who the partner IS — character-focused, not behavior-focused (e.g., \"You're so immature\", \"You're pathetic\"). Must be direct and definitive. Includes insulting or demeaning statements (insults toward the partner's loved ones count), dismissive buzzwords like \"duh\" or \"whatever\", and rejection of the partner's idea or point of view where it goes beyond merely disagreeing (e.g., \"Shut up\"). Unlike B and P, an R can be a question (\"Who cares?\") and is still an R when asked or prompted. Saying \"we\" does NOT get someone out of a Rejection, insulting oneself as part of the R does not either, and backing an R up with behaviors is still an R. Off-topic but mean: assign the mean code as primary and note NC in alternatives_considered. Distinguish from B: Rejection targets a quality the partner possesses; Blame targets their behavior.",
    },
  ],
  defaultPrompt: (opts) =>
    opts.outputType === "continuous" || opts.segmentation === "time"
      ? buildDefaultPrompt(opts)
      : opts.segmentation === "utterance"
        ? VTCS_UTTERANCE_PROMPT
        : VTCS_TURN_PROMPT,
};
