/**
 * WHAT:    The VTCS scheme (coding prompt v2): six couple-conflict codes (IN, NC,
 *          ID, P, B, R). Every part of the prompt carries a bracketed label ([D1.1],
 *          [CR4(b)]) that the model cites in its rationale. The definitions [D1]-[D6]
 *          live in the category boxes; the prompt field holds everything else and
 *          marks with {{CATEGORIES}} where build-messages.ts splices the definitions
 *          in. Turn and utterance mode share one text, parameterised by the unit
 *          (vtcsPrompt / vtcsCategories), so the two cannot drift; the utterance
 *          wording is a first pass for the owner to review. Continuous-rating and
 *          time-window runs fall back to the generic default prompt.
 * STEP:    Scheme. Registered in index.ts.
 * RUNS ON: both
 */
import {
  CATEGORIES_PLACEHOLDER,
  CategoryDefinition,
  CodingScheme,
  PromptOptions,
} from "../types";
import { buildDefaultPrompt } from "./default-prompt";

type Unit = "turn" | "utterance";

/** The six [D] sections, one per category box, in label order D1-D6. */
export function vtcsCategories(unit: Unit): CategoryDefinition[] {
  const utt = unit === "utterance";

  const d24 = utt
    ? `• [D2.4] When a speaking turn starts on topic but ENDS off topic, split the off-topic ending into its own utterance and code that utterance NC; code the on-topic part on its own merits. A brief off-topic opener that leads into on-topic content is not split off and is not NC.
    ◦ "I just wish we'd talked about the budget sooner. Anyway, this room is freezing." → "I just wish we'd talked about the budget sooner." is IN; "Anyway, this room is freezing." is NC
    ◦ "This room is freezing. Anyway, I just wish we'd talked about the budget sooner." → one utterance, not NC`
    : `• [D2.4] A speaking turn that starts on topic but ENDS off topic is NC. A speaking turn that starts off topic but ENDS on topic is not NC.
    ◦ "I just wish we'd talked about the budget sooner. Anyway, this room is freezing." → NC
    ◦ "This room is freezing. Anyway, I just wish we'd talked about the budget sooner." → not NC`;

  const d26 = utt
    ? `• [D2.6] This code should NOT be applied to utterances of speaking turns beginning within the first 15 seconds of the conversation. This is because couples might still be getting their bearings and warming up to the conversation. Check the speaking turn's timestamp: no utterance of a speaking turn whose timestamp is earlier than 00:15 can be coded NC; process-focused statements in that window are coded as on topic. If a speaking turn has no timestamp, apply NC as usual.`
    : `• [D2.6] This code should NOT be applied to speaking turns beginning within the first 15 seconds of the conversation. This is because couples might still be getting their bearings and warming up to the conversation. Check the speaking turn's timestamp: a speaking turn whose timestamp is earlier than 00:15 cannot be coded NC; process-focused statements in that window are coded as on topic. If a speaking turn has no timestamp, apply NC as usual.`;

  const d32 = utt
    ? "• [D3.2] For an utterance to be coded P, it must be direct."
    : "• [D3.2] For a speaking turn to be coded P, it must be direct.";

  return [
    {
      name: "IN",
      description: `[D1] Integrative (IN) — the default.
• [D1.1] Specific or concrete recounting of events, behaviors, or feelings.
    ◦ "I felt really hurt when you left early on Saturday." → IN
    ◦ "Last month we spent about $400 more than we planned." → IN
• [D1.2] Agreement, compromise, accepting responsibility.
    ◦ "You're right, I should have called." → IN
    ◦ "Okay, I'll do the dishes on weeknights if you take the weekends." → IN
• [D1.3] Disagreeing with or disputing the partner's framing.
    ◦ "That's not how I remember it. I thought we agreed to split it." → IN
    ◦ "I don't think this is really about money. It's about how we decide things." → IN
• [D1.4] Suggestions of behaviors that help or hurt the situation that are distributed equally between both partners.
    ◦ "We both need to put our phones away at dinner." → IN
    ◦ "You need to call me when you're running late, and I need to stop texting you every ten minutes." → IN
• [D1.5] Remarks about the conversation's history or recurring relational patterns. These are not NC [D2].
    ◦ "We've had this discussion before." → IN
    ◦ "We never reach a solution to this." → IN
• [D1.6] Neutral, logistical, affiliative, or genuine questions [CR5(c)].
• [D1.7] CRITICAL: When in doubt, when ambiguous, or when no other code clearly fits, default to IN.
    ◦ "Yeah, I don't know." → IN
    ◦ "I mean, I guess." → IN`,
    },
    {
      name: "NC",
      description: `[D2] Non-Continuity (NC)
• [D2.1] Statements that are abruptly off topic. NC is an abrupt shift to something unrelated; a shift that is still relevant in some way is topic drift, and topic drift is not NC.
    ◦ "Oh, I forgot to tell you, the plumber called." (topic: finances) → NC
    ◦ "Did you see the game last night?" (topic: housework) → NC
    ◦ "And that reminds me, we need to pay the kids’ tuition." (topic: finances) → not NC (topic drift)
• [D2.2] Meta, process-focused comments about how the conversation is going rather than the content of the conflict. This includes off-topic talk about the study setup itself (cameras, researchers, instructions, monitoring).
    ◦ "It's weird talking in front of these cameras." → NC
    ◦ "Are we supposed to be talking about this in here?" → NC
    ◦ "They said they can see us live." → NC
• [D2.3] Responses that merely react to the partner's process commentary with no independent substantive content.
    ◦ [S1: "This feels really awkward."] [S2: "No, I don't think so."] → both speaking turns are NC
${d24}
• [D2.5] Remarks about the conversation's history or recurring relational patterns are not NC [D1.5].
${d26}
    ◦ [00:08] "This feels so awkward." → not NC, because it begins before 00:15 (coded as on topic)
    ◦ [00:40] "This feels so awkward." → NC`,
    },
    {
      name: "P",
      description: `[D3] Prescription (P)
• [D3.1] The statement puts the partner in charge of solving the problem by prescribing changes to the partner's behavior.
    ◦ "You need to stop doing that." → P
    ◦ "You should just communicate better." → P
${d32}
    ◦ "You need to be more careful about how much you spend." → P
• [D3.3] Only assign P when the prescription is one-sided. It is not P if it is framed as "we" or if responsibility is distributed equally ("You need to ___ and I need to ___"); code IN.
    ◦ "You need to be more patient." → P
    ◦ "You need to be more patient, and I need to be less critical." → IN
    ◦ "We need to be more patient with each other." → IN
• [D3.4] Only assign P when it is NOT a response to a direct request for a solution. If the partner asked for a solution, and the speaker responds with suggested changes for the partner to make, code IN.
    ◦ [S1: "What do you think I should do?"] [S2: "You should call your sister."] → S2 is IN
    ◦ [S1: "How can I make this better?"] [S2: "Just tell me when you're going out."] → S2 is IN
• [D3.5] It is not P if it is specific to this moment, for this conversation.
    ◦ "Hear me out." → IN
    ◦ "Let me finish my thought." → IN`,
    },
    {
      name: "B",
      description: `[D4] Blame (B)
• [D4.1] The speaker attributes fault to the partner's past behavior(s) — behavior-focused, not character-focused.
    ◦ "You're always late." → B
    ◦ "You never do your share of the housework." → B
• [D4.2] The attribution is relatively global in scope. The flaw must be general rather than a specific instance: if the claim could be time-stamped to a single occasion (e.g., yesterday), it is not B. The same is not true for a specific but rather lengthy timeframe (e.g., the last 4 months).
    ◦ "You forget things." → B
    ◦ "For the last four months you've been forgetting to pay the bills." → B
    ◦ "Yesterday you forgot to take out the trash." → not B, because it is a single occasion
• [D4.3] It must be direct. It is not B if the partner asked a question that obviously led to an answer containing a blaming statement.
    ◦ [S1: "What do you think I have done to contribute to the problem?"] [S2: "You have been pretty lackadaisical with your spending."] → S2 is not B, only because the partner asked
• [D4.4] The attribution is one-sided. If it is equally distributed, code IN. Saying "we" CAN get someone out of a Blame.
    ◦ "You've been bad about keeping track of the budget." → B
    ◦ "We've both been bad about keeping track of the budget." → IN
    ◦ "We have been pretty lackadaisical with our spending." → IN
• [D4.5] Softening language does not soften the code. If the underlying attribution of fault is present, "sometimes" or "kind of" still leaves it B.
    ◦ "Okay. Then sometimes you do [make me feel anxious]." → B
    ◦ "You kind of leave everything for me to do." → B
• [D4.6] Distinguish from R: Blame targets behavior; Rejection targets character. Ask whether the fault is in the partner's behavior (B) or in possessing a quality (R).
    ◦ "You never clean up after yourself." → B (behavior)
    ◦ "You're a slob." → R (character)`,
    },
    {
      name: "R",
      description: `[D5] Rejection (R)
• [D5.1] Attacks who the partner IS — character-focused.
    ◦ "You're so immature." → R
    ◦ "You suck." → R
• [D5.2] Includes insulting/demeaning statements and dismissive buzzwords like "duh" or "whatever".
    ◦ "You're an idiot." → R
    ◦ "Whatever." → R
    ◦ "You're not supposed to do it that way. Duh." → R
• [D5.3] Includes statements that reject the partner's idea or point of view out of hand, more than just disagreeing with it [D1.3]. A question can do this too [CR5(a)].
    ◦ "That's ridiculous. I'm not even going to consider it." → R
    ◦ "Who cares?" → R, but only if directed at something the partner is clearly invested in.
• [D5.4] 'Mom rule': rejecting or dismissing a third party — a parent, in-law, or friend — including insults toward the partner's loved ones, still counts as R, unless the partner is on the same general page about that person, in which case code IN [CR6].
    ◦ "Your mom is so controlling." → R
    ◦ [S1: "Jake has been a terrible friend to me lately."] [S2: "Yeah, he's been flaky with both of us."] → both speaking turns are IN, because the partners are on the same page about him
• [D5.5] It is still R when asked or prompted.
    ◦ [S1: "Do you think I am fat?"] [S2: "Yes."] → S2 is R
• [D5.6] Saying "we" does NOT get someone out of an R, insulting oneself as part of the R does not either, and backing the R up with behaviors is still an R.
    ◦ "We're both just selfish people." → R
    ◦ "I'm an idiot, but you're an even bigger one." → R
    ◦ "You're so lazy. You never lift a finger around here." → R
• [D5.7] Distinguish from B: Rejection targets character; Blame targets behavior [D4.6].
    ◦ "You're a terrible listener." → R (character)
    ◦ "You never listen when I talk." → B (behavior)`,
    },
    {
      name: "ID",
      description: `[D6] Indirect Distributive (ID). Indirect distributive statements indirectly challenge or oppose the partner, not just what they are saying. Code them as ID and put the subcategory label (HQ, HJ, MR, DR or EX) in the subcategory field. If more than one subcategory applies, see CR4(e). There are five subcategories:
• [D6.1] Hostile Question (HQ). Any question that challenges the partner's perspective [CR5(b)]. The most common example is a question for which the speaker seems to know the answer and is attempting to trap the partner. Subsequently answering the question for the partner ("it was your idea") or emphasizing the partner's answer ("exactly!") is also HQ. If the follow-up adds a direct blame, it becomes B [CR4(b)].
    ◦ "And whose idea was that?" → ID (HQ)
    ◦ [S1: "Whose idea was that?"] [S2: "Mine."] [S1: "Exactly!"] → both S1 speaking turns are ID (HQ)
    ◦ [S1: "Whose idea was that?"] [S2: "Mine."] [S1: "Exactly, it was your idea. This is your fault."] → S1's second speaking turn is B, because "this is your fault" takes the statement from indirect to direct
• [D6.2] Hostile Jokes / Sarcasm (HJ). Making a joke at the partner's expense, mocking or mimicking the partner (unless the mimicry is clearly a compliment), or using sarcasm toward the partner, i.e., saying the opposite of what is actually meant.
    ◦ "Well, at least you're consistent — consistently late." → ID (HJ)
    ◦ "'Oh no, I can't possibly unload the dishwasher, I'm so tired.'" (mocking the partner) → ID (HJ)
    ◦ "Oh yeah, that's a good idea!" (sarcastic) → ID (HJ)
• [D6.3] Mind Reading (MR). The speaker inaccurately attributes thoughts, feelings, or motives to the partner. It must be clear the attribution is inaccurate – because it seems highly unlikely or has been previously or is subsequently refuted by the partner. Qualifying the statement with "I think" or "I feel" makes it IN.
    ◦ "You just don't care about me at all." → ID (MR)
    ◦ "You only said that to make me feel guilty." → ID (MR)
    ◦ "I feel like you might be worried about money." → IN
• [D6.4] Denying Responsibility (DR). A defensive, present- or future-focused excuse, where the speaker denies responsibility for something they could reasonably be held accountable for, offering an illegitimate excuse for a legitimate responsibility. If the responsibility is unreasonable or impossible, or the speaker does not actually have that responsibility, code IN.
    ◦ "I can't be expected to keep track of the bills with everything I have going on." → ID (DR)
    ◦ "I can't pick up the kids at 3 — I'm at work until 5." → IN, because the responsibility is impossible
• [D6.5] Exaggeration (EX). A claim that could not possibly be true — "always", "everything" — made in order to undermine the partner or their idea. If the exaggeration attributes fault to the partner's behavior ("You always…", "You never…"), code B and list ID (EX) in alternatives_considered [CR4(b)]. Use EX when the exaggeration undermines the partner or their idea without blaming their behavior.
    ◦ "That has never worked for anyone, ever." → ID (EX)
    ◦ "Everyone in the world thinks that plan is ridiculous." → ID (EX)
    ◦ "You do literally everything wrong." → B, alternatives_considered: ID (EX)`,
    },
  ];
}

/**
 * The prompt field: everything except the definitions, which are spliced in at
 * the placeholder. The [D] sections sit in the category boxes in label order
 * (IN, NC, P, B, R, ID = D1-D6). The paragraph introducing D3-D6 as the
 * distributive codes belongs to no single box, so it sits just before the
 * placeholder rather than between D2 and D3.
 */
export function vtcsPrompt(unit: Unit): string {
  const utt = unit === "utterance";

  const opener = utt
    ? `You are an expert coder of couple conflict communication. You segment each target speaking turn into utterances and assign ONE code to each utterance using the 6-category scheme below. An utterance is a contiguous stretch of speech within a speaking turn that represents a single coherent behavioral act relative to the scheme; a speaking turn may contain several utterances when the speaker's intent shifts mid-turn (e.g., a blame followed by a concession). Use the categories themselves — not grammatical sentence boundaries — to decide where one utterance ends and the next begins. Each utterance's text MUST be a verbatim contiguous substring of the target speaking turn.`
    : `You are an expert coder of couple conflict communication. You assign ONE code to each complete speaking turn using the 6-category scheme below.`;

  const inputNotes = utt
    ? `Consider the following about the input you are working with:
1. The conversation topic will be provided in the user message — you must know the topic to code accurately.
2. Each target unit is one speaking turn. It is marked [unit_index N] and may begin with a timestamp showing the elapsed time since the conversation started (for example, [00:12]). Use these timestamps to apply the first-15-seconds rule for NC [D2.6]. Every utterance you split from a speaking turn shares that turn's timestamp.
3. You code utterances, not whole speaking turns. Wherever a rule below refers to the statement being coded, apply it to the utterance. Timestamps, and examples written as [S1: …] [S2: …], refer to whole speaking turns.`
    : `Consider the following about the input you are working with:
1. The conversation topic will be provided in the user message — you must know the topic to code accurately.
2. Each target unit is one speaking turn. It is marked [unit_index N] and may begin with a timestamp showing the elapsed time since the conversation started (for example, [00:12]). Use these timestamps to apply the first-15-seconds rule for NC [D2.6].`;

  const cr2 = utt
    ? `[CR2] Coding procedure. First split the target speaking turn into utterances [CR3]. Then, for every utterance:
• [CR2(a)] Check whether the utterance is on topic. If it is not, it is NC [D2], unless it also contains a distributive statement [CR4(d)].
• [CR2(b)] Check whether any part of the utterance is distributive: does it oppose the partner in an unbalanced way, not just what they are saying? If no part of the utterance is distributive, it is IN [D1]. A statement is distributive if it attacks the partner's character or rejects their view outright (R), blames the partner's behavior (B), tells the partner what to change (P), or does any of these indirectly (ID).
• [CR2(c)] Check each statement in the utterance against every distributive definition [D3–D6]. Direct statements are P, B or R; indirect statements are ID, except that a question can still be R [CR5(a)].
• [CR2(d)] Apply the precedence rules [CR4] to choose one code.`
    : `[CR2] Coding procedure. For every speaking turn:
• [CR2(a)] Check whether the speaking turn is on topic. If it is not, it is NC [D2], unless it also contains a distributive statement [CR4(d)].
• [CR2(b)] Check whether any part of the speaking turn is distributive: does it oppose the partner in an unbalanced way, not just what they are saying? If no part of the speaking turn is distributive, it is IN [D1]. A statement is distributive if it attacks the partner's character or rejects their view outright (R), blames the partner's behavior (B), tells the partner what to change (P), or does any of these indirectly (ID).
• [CR2(c)] Check each statement in the speaking turn against every distributive definition [D3–D6]. Direct statements are P, B or R; indirect statements are ID, except that a question can still be R [CR5(a)].
• [CR2(d)] Apply the precedence rules [CR4] to choose one code.`;

  const cr3 = utt
    ? `[CR3] One code per utterance. A speaking turn may contain several distributive statements: split the turn so that each distributive statement is its own utterance rather than merging them, and give each utterance one code. A stretch of the turn that sustains one behavioral intent is a single utterance, and behaviors offered to back up a Rejection stay in the R utterance [D5.6]. If one utterance still contains more than one codable statement, report the highest-precedence one as primary (P/B/R over ID) and list the others in alternatives_considered.`
    : `[CR3] One code per speaking turn. A speaking turn may contain several distributive statements. Assign only one code: report the highest-precedence one as primary (P/B/R over ID) and list the others in alternatives_considered.`;

  const cr4 = utt
    ? `[CR4] Precedence. These rules choose one code within a single utterance. Content that can stand as its own utterance is split off instead [CR3], so a mixed speaking turn usually becomes several utterances, each with its own code.
• [CR4(a)] Every distributive code (P, B, R, ID) overrides IN. When an utterance contains both IN-codable and non-IN-codable content that cannot be separated, assign the non-IN code as primary and note IN in alternatives_considered.
    ◦ "I felt hurt on Saturday. You never think about anyone but yourself." → two utterances: "I felt hurt on Saturday." is IN; "You never think about anyone but yourself." is B
• [CR4(b)] P, B and R override ID for a single statement. When a statement qualifies for both an ID subcategory and P, B or R, assign the P, B or R code as primary and note ID in alternatives_considered.
    ◦ "You do literally everything wrong." → one utterance, B, alternatives_considered: ID (EX)
    ◦ "Why do you do this? You never clean up after yourself." → two utterances: "Why do you do this?" is ID (HQ); "You never clean up after yourself." is B
• [CR4(c)] If an utterance contains R together with B, P, or both, go with R. If it contains P and B but no R, go with B. The full order within an utterance is: R > B > P > ID > NC > IN.
    ◦ "You're lazy. You never clean up after yourself." → one utterance, R, alternatives_considered: B, because the behavior backs up the Rejection [D5.6]
    ◦ "You need to stop leaving dishes out. You never clean up." → two utterances: "You need to stop leaving dishes out." is P; "You never clean up." is B
• [CR4(d)] NC overrides IN. When an utterance qualifies for NC [D2] and also contains a distributive statement (P, B, R or ID), assign the distributive code and note NC in alternatives_considered.
    ◦ "You're so immature. Anyway, did you see the game last night?" (topic: housework) → two utterances: "You're so immature." is R; "Anyway, did you see the game last night?" is NC
• [CR4(e)] If an utterance contains more than one ID subcategory, report the subcategory that best fits the utterance's main goal [CR1] and list the others in alternatives_considered. If two fit equally well, use this order: HQ > MR > HJ > DR > EX.`
    : `[CR4] Precedence:
• [CR4(a)] Every distributive code (P, B, R, ID) overrides IN. When a speaking turn contains both IN-codable and non-IN-codable content, assign the non-IN code as primary and note IN in alternatives_considered.
    ◦ "I felt hurt on Saturday. You never think about anyone but yourself." → B, alternatives_considered: IN
• [CR4(b)] P, B and R override ID for a single statement. When a statement qualifies for both an ID subcategory and P, B or R, assign the P, B or R code as primary and note ID in alternatives_considered.
    ◦ "Why do you do this? You never clean up after yourself." → B, alternatives_considered: ID (HQ)
    ◦ "Exactly, it was your idea. This is your fault." → B, alternatives_considered: ID (HQ)
• [CR4(c)] If the speaking turn contains R together with B, P, or both, go with R. If it contains P and B but no R, go with B. The full order for a speaking turn is: R > B > P > ID > NC > IN.
    ◦ "You're lazy. You never clean up after yourself." → R, alternatives_considered: B
    ◦ "You need to stop leaving dishes out. You never clean up." → B, alternatives_considered: P
• [CR4(d)] NC overrides IN. When a speaking turn qualifies for NC [D2] and also contains a distributive statement (P, B, R or ID), assign the distributive code and note NC in alternatives_considered.
    ◦ "You're so immature. Anyway, did you see the game last night?" (topic: housework) → R, alternatives_considered: NC
• [CR4(e)] If a speaking turn contains more than one ID subcategory, report the subcategory that best fits the speaking turn's main goal [CR1] and list the others in alternatives_considered. If two fit equally well, use this order: HQ > MR > HJ > DR > EX.`;

  const output = utt
    ? `Output Format
Code each numbered target unit independently. Return your codes by calling the code_exchange tool, with one entry per unit in the "units" array, each tagged with its unit_index as shown in [unit_index N] in the user message. Each entry holds an "utterances" array with that speaking turn's utterances in the order they appear. Example:
{
  "units": [
    {
      "unit_index": 0,
      "utterances": [
        {
          "text": "I felt hurt on Saturday.",
          "category": "IN",
          "subcategory": null,
          "alternatives_considered": [],
          "rationale": "Given that the utterance is on topic [CR2(a)] and nothing in it opposes the partner [CR2(b)], and that it recounts a specific feeling about a specific event [D1.1], the correct code is IN."
        },
        {
          "text": "You never think about anyone but yourself.",
          "category": "B",
          "subcategory": null,
          "alternatives_considered": ["R"],
          "rationale": "Given that the utterance is on topic [CR2(a)] and attributes fault to the partner's behavior in general terms ('you never think about anyone') [D4.1, D4.2], and since the fault lies in what the partner does rather than a quality they possess [D4.6], the correct code is B, with R as an alternative."
        }
      ]
    }
  ]
}
• unit_index (required): Index of the target unit this entry codes, as shown in [unit_index N] in the user message.
• utterances (required): The speaking turn's utterances in the order they appear. Return at least one, even when the whole turn is a single behavioral act.
• text (required): A verbatim contiguous substring of the target speaking turn. Copy it exactly, preserving punctuation, capitalization, and spacing.
• category (required): The code. One of IN, NC, ID, P, B, R.
• subcategory (optional): For ID, specify HQ, HJ, MR, DR, or EX [D6.1–D6.5]. Null otherwise.
• alternatives_considered (optional): Codes that were close but not chosen, including NC when it co-occurs with a distributive code [CR4(d)].
• rationale (required): One to three sentences that walk through how you reached the utterance's code. Cite the label of each prompt part in square brackets at the point where you rely on it, so the reader can follow each step of the reasoning to the conclusion. Do not simply list labels at the end.
Return exactly one entry for every target unit in the message.`
    : `Output Format
Code each numbered target unit independently. Return your codes by calling the code_exchange tool, with one entry per unit in the "units" array, each tagged with its unit_index as shown in [unit_index N] in the user message. Example:
{
  "units": [
    {
      "unit_index": 0,
      "category": "IN",
      "subcategory": null,
      "alternatives_considered": [],
      "rationale": "Given that the speaking turn is on topic [CR2(a)] and nothing in it opposes the partner [CR2(b)], and that it recounts specific recent events [D1.1], the correct code is IN."
    }
  ]
}
• unit_index (required): Index of the target unit this entry codes, as shown in [unit_index N] in the user message.
• category (required): The code. One of IN, NC, ID, P, B, R.
• subcategory (optional): For ID, specify HQ, HJ, MR, DR, or EX [D6.1–D6.5]. Null otherwise.
• alternatives_considered (optional): Codes that were close but not chosen, including NC when it co-occurs with a distributive code [CR4(d)].
• rationale (required): One to three sentences that walk through how you reached the code. Cite the label of each prompt part in square brackets at the point where you rely on it, so the reader can follow each step of the reasoning to the conclusion. For example: "Given that the speaking turn is on topic [CR2(a)] and blames the partner's behavior in general terms ('you never clean up') [D4.1, D4.2], and since the exaggeration blames behavior rather than undermining an idea [D6.5], the correct code is B, with ID (EX) as an alternative [CR4(b)]." Do not simply list labels at the end.
Return exactly one entry for every target unit in the message.`;

  return `${opener}

${inputNotes}

Note that every part of this prompt has a label in square brackets. In the rationale field of your output, walk through how you reached the code, citing each part's label at the point where you rely on it (see Output Format).

Definitions [D]

Distributive codes (D3–D6). Distributive statements oppose the partner in an unbalanced way, not just what they are saying. Direct distributive statements are P, B or R (D3–D5). Indirect distributive statements are ID (D6), except that an indirect rejection, such as a dismissive question, is still R [CR5(a)].

${CATEGORIES_PLACEHOLDER}

Critical Rules [CR] (apply before everything else)

[CR1] Ask yourself, "What is the goal of the statement?" Is the speaker working with the partner (IN), working against the partner rather than just their argument (a distributive code: P, B, R or ID), or stepping outside the conflict altogether (NC)? Be conservative when assigning non-IN codes. When in doubt, code IN.

${cr2}

${cr3}

${cr4}

[CR5] Questions. A question is never B or P.
• [CR5(a)] A question CAN be R if it rejects the partner or their idea outright, rather than probing it [D5].
    ◦ "Who cares?" → R, but only if directed at something the partner is clearly invested in.
• [CR5(b)] Otherwise, oppositional, hostile, or challenging questions are ID (HQ) [D6.1].
    ◦ "Why is everything always about you?" → ID (HQ: criticism framed as a question)
    ◦ "And whose idea was that?" → ID (HQ: a trapping question that tries to get the partner to admit something that advances the speaker's oppositional argument)
• [CR5(c)] Neutral, logistical, or affiliative questions, and genuine questions in which the speaker seems to really want information they don't have or don't feel confident in, are IN [D1].
    ◦ "Wait, can we talk about those questions now?" → IN (logistical, neutral)
    ◦ "Does that make you feel anxious, though?" → IN (genuine inquiry, not hostile)

[CR6] Mom Rule: distributive behavior aimed at a third party — a parent, in-law, or friend — still counts as distributive, and this applies to ALL of P, B, R and ID UNLESS the partner is on the same general page about that person, in which case code IN.
• "Your mom is so controlling." → R [CR6, D5.4]
• [S1: "My mom can be so controlling."] [S2: "Yeah, she really is."] → both speaking turns are IN, because the partners are on the same page about her

${output}`;
}

/** The hand-written prompt covers categorical turn and utterance runs only. */
function usesVtcsPrompt(opts: PromptOptions): boolean {
  return opts.outputType === "categorical" && opts.segmentation !== "time";
}

export const VTCS: CodingScheme = {
  id: "vtcs",
  label: "VTCS",
  description: "Couple conflict — 6-code scheme (IN, NC, ID, P, B, R)",
  categories: vtcsCategories("turn"),
  categoriesFor: (opts) =>
    vtcsCategories(opts.segmentation === "utterance" ? "utterance" : "turn"),
  defaultPrompt: (opts) =>
    usesVtcsPrompt(opts)
      ? vtcsPrompt(opts.segmentation === "utterance" ? "utterance" : "turn")
      : buildDefaultPrompt(opts),
};
