"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import s from "./TopicTable.module.css";

function FileIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * VCTS-only table for labelling each transcript with its conversation topic.
 * Topics are required for VCTS (the model needs the discussion subject to code
 * accurately), so empty rows are flagged and a running count is shown.
 */
export function TopicTable() {
  const { files, setFileTopic } = useSession();

  const codeable = files.filter((f) => f.rawTranscript !== null);
  const total = codeable.length;
  const setCount = codeable.filter((f) => (f.topic ?? "").trim() !== "").length;
  const allSet = total > 0 && setCount === total;

  return (
    <div className={s.block}>
      <div className={s.head}>
        <span className={s.headTitle}>Conversation topics</span>
        <span className={s.reqTag}>Required for VCTS</span>
        {total > 0 && (
          <span className={`${s.count} ${allSet ? s.countDone : ""}`}>
            {setCount}/{total} set
          </span>
        )}
      </div>
      <p className={s.hint}>
        VCTS codes each turn against what the couple was discussing, so every
        transcript needs a topic before you run it.
      </p>

      {total === 0 ? (
        <div className={s.empty}>
          Upload or transcribe transcripts first to set their topics.
        </div>
      ) : (
        <div className={s.table}>
          <div className={s.tableHead}>
            <div>File</div>
            <div>Topic</div>
          </div>
          {codeable.map((f) => {
            const isAudio = f.audioSource !== undefined;
            const topic = f.topic ?? "";
            const empty = topic.trim() === "";
            return (
              <div key={f.id} className={s.tr}>
                <div className={s.tdFile}>
                  <span className={s.fileIcon}>
                    {isAudio ? <MicIcon /> : <FileIcon />}
                  </span>
                  <span className={s.fileName}>{f.fileName}</span>
                </div>
                <div className={s.tdTopic}>
                  <div className={s.inputWrap}>
                    <input
                      type="text"
                      className={`${s.input} ${empty ? s.inputEmpty : ""}`}
                      value={topic}
                      onChange={(e) => setFileTopic(f.id, e.target.value)}
                      placeholder="e.g., division of household chores"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {topic !== "" && (
                      <button
                        type="button"
                        className={s.clearBtn}
                        aria-label="Clear topic"
                        title="Clear"
                        onClick={(e) => {
                          setFileTopic(f.id, "");
                          e.currentTarget.parentElement
                            ?.querySelector("input")
                            ?.focus();
                        }}
                      >
                        <ClearIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
