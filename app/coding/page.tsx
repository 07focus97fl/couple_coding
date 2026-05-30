"use client";

import { CodingSessionProvider } from "./hooks/CodingSessionContext";
import { StickyHeader } from "./components/layout/StickyHeader";
import { StageRail } from "./components/layout/StageRail";
import { Hero } from "./components/layout/Hero";
import { SectionUpload } from "./components/sections/SectionUpload";
import { SectionModel } from "./components/sections/SectionModel";
import { SectionScheme } from "./components/sections/SectionScheme";
import { SectionRun } from "./components/sections/SectionRun";
import s from "./coding.module.css";

export default function CodingPage() {
  return (
    <CodingSessionProvider>
      <div className={s.pageShell}>
        <StickyHeader />
        <div className={s.workspace}>
          <StageRail />
          <main className={s.shell}>
            <Hero />
            <SectionUpload />
            <SectionModel />
            <SectionScheme />
            <SectionRun />
          </main>
        </div>
      </div>
    </CodingSessionProvider>
  );
}
