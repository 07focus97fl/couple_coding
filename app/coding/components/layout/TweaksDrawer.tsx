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

export function TweaksDrawer() {
  const {
    tweaksOpen,
    setTweaksOpen,
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
            <h2 className={s.title}>Environment</h2>
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
            <p className={s.sub}>
              Signing in with the dev password routes API calls through this
              project&apos;s server-side keys — no personal keys needed.
            </p>
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
            <div className={s.groupLabel}>SESSION</div>
            <p className={s.sub}>
              Session data autosaves to this browser. Clearing site storage
              will reset your uploads, scheme edits, and model choice. API
              keys are entered inline in the steps that use them — ElevenLabs
              in Upload, Anthropic in Model.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
