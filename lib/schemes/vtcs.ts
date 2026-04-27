import { CodingScheme } from "../types";
import { buildDefaultPrompt } from "../prompt-defaults";

const VTCS_RULES = `## Precedence Hierarchy

When a speaking turn contains elements of multiple categories, apply the highest-precedence code. The hierarchy from highest to lowest:

1. RE (Rejection)
2. CR (Personal Criticism)
3. HI (Hostile Imperatives)
4. HQ (Hostile Questions)
5. HJ (Hostile Jokes)
6. JO (Friendly Joking)
7. PR (Presumptive Remarks)
8. DR (Denial of Responsibility)
9. CN (Concessions)
10. AR (Acceptance of Responsibility)
11. SC (Soliciting Criticism)
12. SD (Soliciting Disclosure)
13. DI (Disclosive Statements)
14. QU (Qualifying Statements)
15. DES (Descriptive Statements)
16. TA (Topic Avoidance)
17. DEN (Direct Denial)
18. ID (Implicit Denial)
19. EV (Evasive Remarks)
20. SU (Supportive Remarks)
21. TS (Topic Shifts)
22. PC (Procedural Remarks)
23. AB (Abstract Remarks)
24. NS (Noncommittal Statements)
25. NQ (Noncommittal Questions)
26. UC (Uncodable)

## Context Rules

- Consider previous and upcoming speaker turns for context when interpreting the target turn.
- However, if the target turn contains at least one instance of a substantive code (any code other than UC), it should be coded as that substantive code rather than UC.
- When multiple substantive codes are present, apply the precedence hierarchy above.`;

export const VTCS: CodingScheme = {
  id: "vtcs",
  label: "VTCS",
  description: "Verbal Tactics Coding Scheme (Sillars, 1986)",
  categories: [
    // DE — Denial & Equivocation
    { name: "DEN", description: "DE — Denial & Equivocation: Direct Denial. The speaker explicitly states that a conflict or problem does not exist (e.g., \"There's no problem\" or \"We don't disagree about that\"). Must be an overt, unambiguous denial — not merely offering a rationale. If the speaker provides an explanation or justification instead of a flat denial, code as ID." },
    { name: "ID", description: "DE — Denial & Equivocation: Implicit Denial. The speaker implies that a conflict does not exist by offering a rationale, explanation, or justification without explicitly denying it (e.g., \"I only did that because…\" or \"That's just how things work\"). Distinguished from DEN by the absence of an explicit denial statement, and from DR by not specifically minimizing personal fault — ID addresses the existence of the issue itself." },
    { name: "EV", description: "DE — Denial & Equivocation: Evasive Remarks. The speaker fails to acknowledge or deny the conflict; responses are ambiguous, uncommitted, or vague (e.g., \"I don't know\" when avoidance is the intent, or changing tone without addressing the topic). Distinguished from NS by being a response to a conflict-relevant prompt but deliberately non-substantive. Distinguished from TS by not introducing a new topic." },

    // TM — Topic Management
    { name: "TS", description: "TM — Topic Management: Topic Shifts. The speaker implicitly terminates conflict discussion by changing the subject to a different, unrelated topic without explicitly refusing to discuss the original one (e.g., shifting from finances to weekend plans). Distinguished from TA by the absence of an explicit refusal — the speaker simply moves on." },
    { name: "TA", description: "TM — Topic Management: Topic Avoidance. The speaker explicitly refuses to discuss a conflict topic (e.g., \"I don't want to talk about this\" or \"Let's not go there\"). Distinguished from TS by being an overt, stated refusal rather than a silent redirect." },

    // NR — Noncommittal Remarks
    { name: "NS", description: "NR — Noncommittal Remarks: Noncommittal Statements. Neutral, declarative statements that are unrelated to the conflict topic and do not advance or avoid it (e.g., commenting on the weather, stating a mundane fact). Distinguished from EV by not being a response to a conflict-relevant prompt, and from DES by lacking any conflict content." },
    { name: "NQ", description: "NR — Noncommittal Remarks: Noncommittal Questions. Unfocused or conflict-irrelevant questions that do not advance or avoid the conflict (e.g., \"What time is it?\" during a conflict discussion). Distinguished from SD and HQ by having no conflict relevance." },
    { name: "AB", description: "NR — Noncommittal Remarks: Abstract Remarks. Generalizations, hypotheticals, or philosophical statements that stand in for engagement with the specific conflict (e.g., \"Well, nobody's perfect\" or \"That's just how relationships are\"). Distinguished from QU by not limiting the scope of a specific issue, and from DES by not referring to specific conflict events." },
    { name: "PC", description: "NR — Noncommittal Remarks: Procedural Remarks. Meta-conversational statements about the discussion process itself rather than the conflict content (e.g., \"Can we take a break?\" or \"You interrupted me\"). Distinguished from TA by not refusing a topic — instead commenting on how the conversation is being conducted." },

    // IR — Irreverent Remarks
    { name: "JO", description: "IR — Irreverent Remarks: Friendly Joking. Humor that is NOT at the partner's expense — lighthearted, tension-reducing, or self-deprecating (e.g., \"Well, at least we're consistent!\" said warmly). Distinguished from HJ by the absence of targeting the partner with sarcasm or ridicule. If humor contains any implicit criticism of the partner, code as HJ instead." },

    // AN — Analytic Remarks
    { name: "DES", description: "AN — Analytic Remarks: Descriptive Statements. Nonevaluative, observable, verifiable statements about conflict events or behaviors (e.g., \"You came home at 9 last night\" or \"We haven't discussed the budget this month\"). Must describe facts without evaluation or judgment. Distinguished from CR by the absence of criticism or character assessment, and from DI by referring to observable events rather than internal states." },
    { name: "DI", description: "AN — Analytic Remarks: Disclosive Statements. Nonevaluative statements about the speaker's own unobservable thoughts, feelings, or internal states (e.g., \"I feel worried when…\" or \"I've been thinking that…\"). Must be self-referential and nonhostile. Distinguished from DES by referring to internal states rather than observable events, and from CR by being about oneself rather than the partner." },
    { name: "QU", description: "AN — Analytic Remarks: Qualifying Statements. Statements that explicitly limit the scope, severity, or generality of the conflict (e.g., \"It's only about the weekends\" or \"This isn't a huge deal\"). Distinguished from AB by addressing the specific conflict rather than making general statements, and from SU by not expressing acceptance or warmth." },
    { name: "SD", description: "AN — Analytic Remarks: Soliciting Disclosure. Nonhostile questions inviting the partner to share their thoughts, feelings, or perspective (e.g., \"How do you feel about that?\" or \"What are you thinking?\"). Must be genuinely open-ended and nonleading. Distinguished from HQ by the absence of implied blame, and from SC by asking about the partner's perspective rather than inviting criticism of oneself." },
    { name: "SC", description: "AN — Analytic Remarks: Soliciting Criticism. Nonhostile questions explicitly inviting the partner to criticize the speaker (e.g., \"What am I doing wrong?\" or \"Tell me what bothers you about my behavior\"). Must be a genuine, nondefensive invitation. Distinguished from SD by specifically inviting criticism of oneself." },

    // CF — Confrontive Remarks
    { name: "CR", description: "CF — Confrontive Remarks: Personal Criticism. Criticizes the partner's character traits, personality, or past behavior — backward-looking evaluation (e.g., \"You're so irresponsible\" or \"You always forget\"). Distinguished from HI by being backward-looking (evaluating what was done) rather than forward-looking (demanding change). Distinguished from RE by not being a strong reactive dismissal of what the partner just said." },
    { name: "RE", description: "CF — Confrontive Remarks: Rejection. Antagonistic disagreement with strong reactive dismissal — the speaker forcefully rejects the partner's statement, position, or character (e.g., \"That's ridiculous\" or \"You're completely wrong\"). Distinguished from CR by being a direct reactive dismissal rather than a general character critique." },
    { name: "HI", description: "CF — Confrontive Remarks: Hostile Imperatives. Prescriptive demands that implicitly blame the partner — forward-looking commands (e.g., \"You need to stop doing that\" or \"Just clean up after yourself\"). Distinguished from CR by being forward-looking (demanding future change) rather than backward-looking (evaluating past behavior)." },
    { name: "HJ", description: "CF — Confrontive Remarks: Hostile Jokes. Humor or sarcasm that targets the partner — mockery, ridicule, or veiled insults disguised as humor (e.g., \"Oh sure, because you're such an expert\" said sarcastically). Distinguished from JO by targeting the partner with negativity. If humor is warm or self-deprecating, code as JO instead." },
    { name: "HQ", description: "CF — Confrontive Remarks: Hostile Questions. Leading or rhetorical questions that imply blame or criticism (e.g., \"Why can't you ever…?\" or \"Don't you think you should have…?\"). Distinguished from SD by the presence of implied blame, and from SC by criticizing the partner rather than inviting criticism of oneself." },
    { name: "PR", description: "CF — Confrontive Remarks: Presumptive Remarks. The speaker attributes thoughts, feelings, motives, or intentions to the partner that the partner has not acknowledged (e.g., \"You obviously don't care\" or \"You're just saying that to avoid the issue\"). Distinguished from CR by attributing unacknowledged internal states rather than criticizing observable traits or behavior." },
    { name: "DR", description: "CF — Confrontive Remarks: Denial of Responsibility. The speaker minimizes or denies their own role in the conflict (e.g., \"It's not my fault\" or \"I had nothing to do with that\"). Distinguished from ID by specifically deflecting personal blame rather than denying the conflict's existence, and from AR by being the opposite — refusing responsibility rather than accepting it." },

    // CL — Conciliatory Remarks
    { name: "SU", description: "CL — Conciliatory Remarks: Supportive Remarks. Statements expressing understanding, acceptance, or positive regard for the partner while still acknowledging the conflict exists (e.g., \"I understand why you feel that way\" or \"I appreciate you telling me\"). Distinguished from CN by not offering to change or compromise, and from JO by being earnest rather than humorous." },
    { name: "CN", description: "CL — Conciliatory Remarks: Concessions. The speaker expresses willingness to change, compromise, or meet the partner partway (e.g., \"I can try to do that differently\" or \"Let's find a middle ground\"). Distinguished from AR by offering future change rather than accepting past blame, and from SU by going beyond understanding to propose action." },
    { name: "AR", description: "CL — Conciliatory Remarks: Acceptance of Responsibility. The speaker attributes conflict responsibility to themselves or to both partners (e.g., \"I should have handled that better\" or \"We both contributed to this\"). Distinguished from DR by accepting rather than denying responsibility, and from CN by acknowledging past fault rather than proposing future change." },

    // Other
    { name: "UC", description: "Uncodable. Backchannels (e.g., \"mm-hmm\", \"yeah\", \"uh-huh\"), incomplete or unintelligible utterances, simple agreement/disagreement tokens with no substantive conflict content, or turns that cannot be reliably classified into any other category. Use only when no other code applies." },
  ],

  defaultPrompt: (g) => buildDefaultPrompt(g, VTCS_RULES),
};
