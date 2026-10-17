# Test CSV format for Couple Conversation Coder

The format the `/coding` page accepts for human-coded conversations ("audit mode"). See
`mock_test_format.csv` in this folder for a working example with two conversations.

## Shape

- One CSV file holds any number of conversations.
- One row per speaking turn, in the order spoken.
- First row is the header. UTF-8, comma-separated, standard CSV quoting: wrap a cell in double
  quotes if it contains a comma, quote or line break, and write a quote inside it as `""`.

## Columns

Header names are matched ignoring case and surrounding spaces. Column order doesn't matter.

| Column | Required | What goes in it |
|---|---|---|
| `exchange_id` | yes | `<conversation id>_<turn number>`, e.g. `couple_101_1_7`. Everything before the **last** `_N` is the conversation id, so all rows of one conversation must share that prefix. The trailing number only has to be unique within the conversation; rows are coded in file order, not by this number. |
| `speaker` | yes | Who spoke, e.g. `Husband` / `Wife` or `Partner A` / `Partner B`. Use the same two labels throughout a conversation. Never blank. |
| `text` | yes | What they said in that turn, verbatim. |
| `topic` | no | The conversation topic, e.g. `Division of housework`. The model is told it and needs it to judge off-topic (NC). The first non-blank cell in a conversation is used; repeating it on every row is fine. |
| `start_time` | no, but needed for the 15-second NC rule [D2.6] | When the turn starts, measured from the start of **that conversation**: seconds (`12`, `12.4`) or `m:ss` / `mm:ss` / `h:mm:ss` (`0:12`, `00:12.5`, `1:02:03`). The model sees it as `[00:12]`. Leave the whole column out (or a cell blank) and that turn gets no timestamp. |
| `end_time` | no | When the turn ends, same formats. If missing, the next turn's start is used. |
| `final_code` | no | The human code: one of `IN`, `NC`, `ID`, `P`, `B`, `R`. Leave blank if humans didn't code that turn: it's still sent to the model as context but left out of agreement. |
| anything else | no | Kept untouched and written back in the audit export (e.g. `coder_notes`, `id_subcategory`, a coder's initials). |

The human code (`final_code`) is **never** sent to the model.

## Rules a converter must follow

1. Keep turns in spoken order within each conversation, and keep each conversation's rows
   together.
2. Build `exchange_id` as the conversation id plus `_` plus the turn number. The conversation id
   may itself contain underscores and numbers (`couple_101_1`); only the final `_N` is stripped.
   Give every conversation a different id.
3. Times restart at 0 for each conversation.
4. Codes must be exactly the six letters above (case doesn't matter; spaces are trimmed). An ID
   subcategory (HQ, HJ, MR, DR, EX) goes in a separate column of your choosing, not in
   `final_code`.
5. One speaking turn = everything one person says until the other person speaks.

## After upload

Each conversation becomes its own row in Step 01; tick one or two for a cheap trial. Time-window
segmentation is unavailable for CSV conversations (they have no word-level timings); turn and
utterance modes work. "Export audit CSV" returns this file with the model's code, rationale, the
run settings and per-call cost appended to each row.
