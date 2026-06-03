"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import s from "./landing.module.css";

export default function LandingPage() {
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(s.visible);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(`.${s.reveal}`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={s.page}>
      {/* NAV */}
      <nav ref={navRef} className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}>
        <div className={s.navBrand}>
          <span className={s.navLogo}>
            CCC<span>.</span>
          </span>
          <span className={s.navWordmark}>Couple Conversation Coder</span>
        </div>
        <div className={s.navLinks}>
          <a href="#how" className={s.navLink}>How it works</a>
          <a href="#features" className={s.navLink}>Features</a>
          <a href="#schemes" className={s.navLink}>Coding schemes</a>
          <Link href="/coding" className={s.navCta}>Get started</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className={s.hero}>
        <div className={s.heroBadge}>
          For relationships researchers, by relationships researchers
        </div>
        <h1 className={s.heroTitle}>
          Behavioral coding,<br />
          <em>automated</em>
        </h1>
        <p className={s.heroSub}>
          Upload a transcript — or raw audio. Choose a validated coding scheme.
          Get every turn, utterance, or time window coded with a transparent
          rationale — ready for validation against human coders.
        </p>
        <div className={s.heroActions}>
          <Link href="/coding" className={s.btnPrimary}>
            Try CCC now
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a href="#how" className={s.btnGhost}>See how it works</a>
        </div>
      </section>

      {/* APP PREVIEW — a faithful look at the Run & Review panel */}
      <div className={s.demoSection}>
        <div className={s.appPreview}>
          <div className={s.appHead}>
            <div className={s.appCircle}>4</div>
            <div className={s.appHeadTitle}>Run</div>
            <div className={s.appHeadMeta}>14/87</div>
            <div className={s.appHeadRight}>
              <span className={s.appRunBtn}>Running…</span>
              <svg
                className={s.appChevron}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div className={s.appBody}>
            <div className={s.appStats}>
              <span className={s.appStatsLeft}>
                <span className={s.appStateDot} />
                <span className={s.appStatsText}>14/87</span>
                <span className={s.appStatsDot}>·</span>
                <span className={s.appStatsDim}>42.3s elapsed</span>
                <span className={s.appStatsDot}>·</span>
                <span className={s.appStatsDim}>~3m 39s left</span>
                <span className={s.appStatsDot}>·</span>
                <span className={s.appStatsDim}>20/min</span>
                <span className={s.appStatsDot}>·</span>
                <span className={s.appStatsDim}>$0.064</span>
              </span>
              <span className={s.appLogsBtn}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                API logs (14)
              </span>
            </div>

            <div className={s.appProgress}>
              <div className={s.appProgressFill} style={{ width: "16%" }} />
            </div>

            <div className={s.appHist}>
              <div className={s.appHistChart}>
                <div className={s.appHistCol}>
                  <div className={s.appHistBarWrap}>
                    <div className={s.appHistCount}>6</div>
                    <div
                      className={s.appHistBar}
                      style={{ height: "100%", background: "#7a8a99" }}
                    />
                  </div>
                  <div className={s.appHistLabel}>IN</div>
                </div>
                <div className={s.appHistCol}>
                  <div className={s.appHistBarWrap}>
                    <div className={s.appHistCount}>3</div>
                    <div
                      className={s.appHistBar}
                      style={{ height: "50%", background: "#907a5c" }}
                    />
                  </div>
                  <div className={s.appHistLabel}>B</div>
                </div>
                <div className={s.appHistCol}>
                  <div className={s.appHistBarWrap}>
                    <div className={s.appHistCount}>3</div>
                    <div
                      className={s.appHistBar}
                      style={{ height: "50%", background: "#a88a5e" }}
                    />
                  </div>
                  <div className={s.appHistLabel}>ID</div>
                </div>
                <div className={s.appHistCol}>
                  <div className={s.appHistBarWrap}>
                    <div className={s.appHistCount}>2</div>
                    <div
                      className={s.appHistBar}
                      style={{ height: "33%", background: "#c18660" }}
                    />
                  </div>
                  <div className={s.appHistLabel}>R</div>
                </div>
              </div>
            </div>

            <div className={s.appRows}>
              <div className={s.appRow}>
                <div className={s.appIdx}>11</div>
                <div className={s.appSpeaker} data-speaker="a">
                  <span className={s.appSpkDot} />
                  <span className={s.appSpkNum}>11</span>
                </div>
                <div className={s.appText}>
                  <div className={s.appUtter}>
                    {"Honestly, thank you for handling dinner tonight — that took a lot off my plate."}
                  </div>
                  <div className={s.appRationale}>
                    {"Specific appreciation acknowledging the partner’s contribution — integrative, the default constructive code."}
                  </div>
                </div>
                <div
                  className={s.appChip}
                  style={{ background: "#7a8a992e", color: "#7a8a99" }}
                >
                  IN
                </div>
              </div>

              <div className={s.appRow}>
                <div className={s.appIdx}>12</div>
                <div className={s.appSpeaker} data-speaker="b">
                  <span className={s.appSpkDot} />
                  <span className={s.appSpkNum}>12</span>
                </div>
                <div className={s.appText}>
                  <div className={s.appUtter}>
                    {"I just feel like I’m the only one who ever notices when something needs doing."}
                  </div>
                  <div className={s.appRationale}>
                    {"Global, one-sided fault aimed at the partner’s behavior, not character — Blame."}
                  </div>
                </div>
                <div
                  className={s.appChip}
                  style={{ background: "#907a5c2e", color: "#907a5c" }}
                >
                  B
                </div>
              </div>

              <div className={s.appRow}>
                <div className={s.appIdx}>13</div>
                <div className={s.appSpeaker} data-speaker="a">
                  <span className={s.appSpkDot} />
                  <span className={s.appSpkNum}>13</span>
                </div>
                <div className={s.appText}>
                  <div className={s.appUtter}>
                    {"That’s not fair — I do plenty around here, you just don’t see it."}
                  </div>
                  <div className={s.appRationale}>
                    {"Denies responsibility and dismisses the partner’s account — Indirect Distributive."}
                  </div>
                </div>
                <div
                  className={s.appChip}
                  style={{ background: "#a88a5e2e", color: "#a88a5e" }}
                >
                  ID
                </div>
              </div>

              <div className={s.appRow}>
                <div className={s.appIdx}>14</div>
                <div className={s.appSpeaker} data-speaker="b">
                  <span className={s.appSpkDot} />
                  <span className={s.appSpkNum}>14</span>
                </div>
                <div className={s.appText}>
                  <div className={s.appUtter}>
                    {"Okay. Maybe we can find a system that actually works for both of us."}
                  </div>
                  <div className={s.appRationale}>
                    {"Moves toward a mutual, equally-distributed solution — integrative repair."}
                  </div>
                </div>
                <div
                  className={s.appChip}
                  style={{ background: "#7a8a992e", color: "#7a8a99" }}
                >
                  IN
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className={s.howSection} id="how">
        <div className={s.howInner}>
          <div className={s.reveal}>
            <div className={s.sectionLabel}>Process</div>
            <div className={s.sectionTitle}>Four steps from transcript to coded data</div>
          </div>
          <div className={`${s.howSteps} ${s.reveal}`}>
            <div className={s.step}>
              <div className={s.stepNum}>01</div>
              <div className={s.stepTitle}>Upload transcript</div>
              <div className={s.stepText}>
                Drop in a word-level JSON transcript — or upload raw audio (mp3, m4a, wav) and we transcribe it automatically with ElevenLabs. Speaker turns are segmented for you.
              </div>
            </div>
            <div className={s.step}>
              <div className={s.stepNum}>02</div>
              <div className={s.stepTitle}>Choose a scheme</div>
              <div className={s.stepText}>
                Code with our validated couple-conflict scheme (VCTS) or your own custom categories — as categorical codes or continuous 1–7 ratings. Valence, SPAFF, RCISS &amp; CIRS are on the way.
              </div>
            </div>
            <div className={s.step}>
              <div className={s.stepNum}>03</div>
              <div className={s.stepTitle}>Code with context</div>
              <div className={s.stepText}>
                Your chosen model — Claude, GPT, or Gemini — codes each turn, utterance, or time window using a configurable window of surrounding context.
              </div>
            </div>
            <div className={s.step}>
              <div className={s.stepNum}>04</div>
              <div className={s.stepTitle}>Export &amp; validate</div>
              <div className={s.stepText}>
                Download a CSV with codes, rationales, and speaker info. Filter by speaker, choose your columns.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={s.featuresSection} id="features">
        <div className={`${s.featuresHeader} ${s.reveal}`}>
          <div>
            <div className={s.sectionLabel}>Capabilities</div>
            <div className={s.sectionTitle}>Built for rigorous research</div>
          </div>
        </div>
        <div className={`${s.featuresGrid} ${s.reveal}`}>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <h3>Audio or transcript in</h3>
            <p>Upload word-level JSON or raw audio (auto-transcribed via ElevenLabs); words are grouped into coherent speaker turns automatically.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <h3>Validated coding schemes</h3>
            <p>Ships with a validated couple-conflict scheme (VCTS) plus custom categories. Valence, SPAFF, RCISS &amp; CIRS — from decades of relationships research — are coming soon.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <h3>Custom categories</h3>
            <p>Define your own coding taxonomy for novel research paradigms. Full flexibility over labels and definitions.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3>Contextual coding</h3>
            <p>Configurable context window of prior turns lets the model account for escalation, repair, and reciprocity patterns.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <h3>Real-time streaming</h3>
            <p>Watch codes arrive turn-by-turn. No waiting for batch processing — results stream as they&apos;re generated.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <h3>Flexible CSV export</h3>
            <p>Control which columns to include, filter by speaker, and export data ready for your analysis pipeline.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </div>
            <h3>Categorical or continuous</h3>
            <p>Assign discrete codes, or rate each unit on continuous 1–7 scales with your own min/max anchors.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <h3>Flexible segmentation</h3>
            <p>Code by speaking turn, by utterance, or by fixed time window — with optional per-speaker coding.</p>
          </div>
          <div className={s.featureCard}>
            <div className={s.featureIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
            </div>
            <h3>Model of your choice</h3>
            <p>Run on Anthropic, OpenAI, or Google models with your own API key — pick the cost/quality tradeoff you want.</p>
          </div>
        </div>
      </section>

      {/* CODING SCHEMES */}
      <section className={s.schemesSection} id="schemes">
        <div className={s.schemesInner}>
          <div className={s.reveal}>
            <div className={s.sectionLabel}>Coding systems</div>
            <div className={`${s.sectionTitle} ${s.schemesTitleLight}`}>
              Validated schemes, with more on the way
            </div>
            <div className={s.sectionDesc}>Start with our couple-conflict scheme or bring your own — more validated systems are coming.</div>
          </div>
          <div className={`${s.schemesGrid} ${s.reveal}`}>
            <div className={s.schemeCard}>
              <div className={s.schemeName}>
                VCTS
                <span className={s.schemeAvail}>Available</span>
              </div>
              <div className={s.schemeFull}>Couple Conflict Coding</div>
              <div className={s.schemeDesc}>
                Six-code conflict scheme — Integrative, Non-Constructive, Indirect Distributive, Prescription, Blame, Rejection.
              </div>
            </div>
            <div className={`${s.schemeCard} ${s.schemeCardSoon}`}>
              <div className={s.schemeName}>
                Valence
                <span className={s.schemeSoon}>Coming soon</span>
              </div>
              <div className={s.schemeFull}>Positive / Negative Affect</div>
              <div className={s.schemeDesc}>
                Binary affect coding — the simplest and most common starting point for interaction research.
              </div>
            </div>
            <div className={`${s.schemeCard} ${s.schemeCardSoon}`}>
              <div className={s.schemeName}>
                SPAFF
                <span className={s.schemeSoon}>Coming soon</span>
              </div>
              <div className={s.schemeFull}>Specific Affect Coding System</div>
              <div className={s.schemeDesc}>
                Gottman&apos;s fine-grained system distinguishing contempt, defensiveness, stonewalling, and more.
              </div>
            </div>
            <div className={`${s.schemeCard} ${s.schemeCardSoon}`}>
              <div className={s.schemeName}>
                RCISS
                <span className={s.schemeSoon}>Coming soon</span>
              </div>
              <div className={s.schemeFull}>Rapid Couples Interaction Scoring</div>
              <div className={s.schemeDesc}>
                Efficient speaker-listener distinction with positive and negative codes for each role.
              </div>
            </div>
            <div className={`${s.schemeCard} ${s.schemeCardSoon}`}>
              <div className={s.schemeName}>
                CIRS
                <span className={s.schemeSoon}>Coming soon</span>
              </div>
              <div className={s.schemeFull}>Couples Interaction Rating System</div>
              <div className={s.schemeDesc}>
                Global ratings of conflict, support, and withdrawal behaviors at the conversation level.
              </div>
            </div>
            <Link href="/coding" className={`${s.schemeCard} ${s.schemeCustom}`} style={{ textDecoration: "none" }}>
              <div className={s.plus}>+</div>
              <span className={s.schemeCustomLabel}>Define your own scheme</span>
            </Link>
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className={s.transparencySection}>
        <div className={`${s.transparencyLayout} ${s.reveal}`}>
          <div className={s.rationaleExample}>
            <div className={s.rationaleHeader}>
              <div className={s.indicator} />
              Coded · turns 12–13
            </div>
            <div className={s.rationaleRows}>
              <div className={s.rationaleRow}>
                <div className={s.rRowHead}>
                  <span className={s.rSpeaker} data-speaker="b">
                    <span className={s.rDot} />
                    Turn 12
                  </span>
                  <span
                    className={s.rChip}
                    style={{ background: "#907a5c2e", color: "#907a5c" }}
                  >
                    B
                  </span>
                </div>
                <div className={s.rUtter}>
                  {"I just feel like I’m the only one who ever notices when something needs doing."}
                </div>
                <div className={s.rRationale}>
                  {"Global, one-sided fault aimed at the partner’s behavior, not character — Blame."}
                </div>
              </div>
              <div className={s.rationaleRow}>
                <div className={s.rRowHead}>
                  <span className={s.rSpeaker} data-speaker="a">
                    <span className={s.rDot} />
                    Turn 13
                  </span>
                  <span
                    className={s.rChip}
                    style={{ background: "#a88a5e2e", color: "#a88a5e" }}
                  >
                    ID
                  </span>
                </div>
                <div className={s.rUtter}>
                  {"That’s not fair — I do plenty around here, you just don’t see it."}
                </div>
                <div className={s.rRationale}>
                  {"Denies responsibility and dismisses the partner’s account. Read against turn 12, it escalates the exchange rather than repairing it."}
                </div>
              </div>
            </div>
          </div>
          <div className={s.transparencyText}>
            <div className={s.sectionLabel}>Transparency</div>
            <h3>Every code comes with a reason</h3>
            <p className={s.sectionDesc} style={{ marginTop: "0.5rem" }}>
              The key differentiator: auditable rationales for every single coding decision.
            </p>
            <ul className={s.transparencyPoints}>
              <li>
                <div className={s.check}>{"\u2713"}</div>
                Compare AI rationales against your human coders&apos; reasoning to identify disagreements and edge cases
              </li>
              <li>
                <div className={s.check}>{"\u2713"}</div>
                Spot systematic biases by reviewing rationale patterns across an entire transcript
              </li>
              <li>
                <div className={s.check}>{"\u2713"}</div>
                Use rationales as a training tool for new research assistants learning to code
              </li>
              <li>
                <div className={s.check}>{"\u2713"}</div>
                Include decision logic in supplementary materials for full methodological transparency
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={s.ctaSection} id="start">
        <h2 className={s.ctaTitle}>
          Start coding <em>conversations</em>
        </h2>
        <p className={s.ctaDesc}>
          Upload your first transcript and see automated behavioral coding
          with transparent rationales in minutes.
        </p>
        <Link href="/coding" className={s.btnPrimary} style={{ position: "relative" }}>
          Launch CCC
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={16} height={16}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div>
          <span className={s.footerBrand}>CCC</span>
          <span style={{ marginLeft: "1rem" }}>Couple Conversation Coder</span>
        </div>
      </footer>
    </div>
  );
}
