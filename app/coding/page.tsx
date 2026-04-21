"use client";

import { CodingSessionProvider } from "./hooks/CodingSessionContext";
import { StickyHeader } from "./components/layout/StickyHeader";
import { Hero } from "./components/layout/Hero";
import { TweaksDrawer } from "./components/layout/TweaksDrawer";
import { SectionUpload } from "./components/sections/SectionUpload";
import { SectionModel } from "./components/sections/SectionModel";
import { SectionScheme } from "./components/sections/SectionScheme";
import { SectionRun } from "./components/sections/SectionRun";
import { RulesDrawer } from "./components/sections/RulesDrawer";
import s from "./coding.module.css";

export default function CodingPage() {
  return (
    <CodingSessionProvider>
      <div className={s.pageShell}>
        <StickyHeader />
        <main className={s.shell}>
          <Hero />
          <SectionUpload />
          <SectionModel />
          <SectionScheme />
          <SectionRun />
        </main>
        <RulesDrawer />
        <TweaksDrawer />
      </div>
    </CodingSessionProvider>
  );
}
