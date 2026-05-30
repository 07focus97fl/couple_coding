"use client";

import s from "./Hero.module.css";

export function Hero() {
  return (
    <header className={s.hero}>
      <h1 className={s.title}>Couples coding, end to end.</h1>
      <p className={s.description}>
        Upload transcripts, pick a model, tune your scheme, and code every turn
        with transparent rationale — all on one page.
      </p>
    </header>
  );
}
