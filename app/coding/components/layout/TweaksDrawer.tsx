"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import s from "./TweaksDrawer.module.css";

function XIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function TweaksDrawer() {
  const {
    tweaksOpen,
    setTweaksOpen,
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
    devSignedIn,
    devPassword,
    devAuthError,
    setDevPassword,
    handleDevSignIn,
    handleDevSignOut,
  } = useSession();

  if (!tweaksOpen) return null;

  return (
    <div
      className={s.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) setTweaksOpen(false);
      }}
    >
      <aside className={s.drawer}>
        <div className={s.head}>
          <div>
            <div className={s.eyebrow}>TWEAKS</div>
            <h2 className={s.title}>Keys & environment</h2>
          </div>
          <button
            type="button"
            onClick={() => setTweaksOpen(false)}
            className={s.closeBtn}
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        <div className={s.body}>
          <section className={s.group}>
            <div className={s.groupLabel}>DEVELOPER ACCESS</div>
            {devSignedIn ? (
              <div className={s.row}>
                <div className={s.signedInBadge}>
                  <span className={s.signedInDot} /> Signed in
                </div>
                <button
                  type="button"
                  onClick={handleDevSignOut}
                  className={s.ghostBtn}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <label className={s.label}>Password</label>
                <div className={s.row}>
                  <input
                    type="password"
                    className={s.input}
                    value={devPassword}
                    onChange={(e) => setDevPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDevSignIn();
                    }}
                    placeholder="Enter password…"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleDevSignIn}
                    className={s.primaryBtn}
                  >
                    Sign in
                  </button>
                </div>
                {devAuthError && (
                  <p className={s.errorText}>{devAuthError}</p>
                )}
              </>
            )}
          </section>

          <section className={s.group}>
            <div className={s.groupLabel}>ANTHROPIC API KEY</div>
            <p className={s.sub}>
              Stored locally in your browser. Never sent anywhere except the
              Anthropic API during a run.
            </p>
            <div className={s.row}>
              <input
                type={showKey ? "text" : "password"}
                className={s.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={s.iconBtn}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                <EyeIcon open={showKey} />
              </button>
            </div>
          </section>

          <section className={s.group}>
            <div className={s.groupLabel}>SESSION</div>
            <p className={s.sub}>
              Session data autosaves to this browser. Clearing site storage
              will reset your uploads, scheme edits, and model choice.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
