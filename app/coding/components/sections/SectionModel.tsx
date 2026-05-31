"use client";

import { useMemo, useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import {
  formatLatency,
  getModel,
  MODELS,
  ModelDef,
  PROVIDERS,
  ProviderDef,
} from "@/lib/models";
import s from "./SectionModel.module.css";

function ProviderIcon({ id }: { id: ProviderDef["id"] }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (id === "anthropic") {
    return (
      <svg {...common}>
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      </svg>
    );
  }
  if (id === "openai") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.8" r="3.8" />
        <circle cx="8.6" cy="14.6" r="3.8" />
        <circle cx="15.4" cy="14.6" r="3.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 12a8 8 0 11-2.3-5.6" />
      <path d="M20 12h-6" />
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

export function SectionModel() {
  const {
    selectedModel,
    setSelectedModel,
    activeProvider,
    apiKey,
    setApiKey,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    stepDone,
  } = useSession();
  const [filter, setFilter] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shown, setShown] = useState(false);

  // Only the key for the selected model's provider is shown — that's the one
  // the run uses. Keys for other providers stay saved in this browser and
  // reappear if you switch back to a model from that provider.
  const providerKeys = [
    { id: "anthropic" as const, name: "Anthropic", value: apiKey, setValue: setApiKey, placeholder: "sk-ant-…" },
    { id: "openai" as const, name: "OpenAI", value: openaiKey, setValue: setOpenaiKey, placeholder: "sk-…" },
    { id: "google" as const, name: "Google", value: googleKey, setValue: setGoogleKey, placeholder: "AIza…" },
  ];
  const activeKey =
    providerKeys.find((k) => k.id === activeProvider) ?? providerKeys[0];

  const current = getModel(selectedModel) ?? null;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return MODELS;
    return MODELS.filter((m) =>
      `${m.name} ${m.desc} ${m.provider}`.toLowerCase().includes(q),
    );
  }, [filter]);

  const byProvider = PROVIDERS.map((p) => ({
    provider: p,
    models: filtered.filter((m) => m.provider === p.id),
  })).filter((g) => g.models.length > 0);

  const meta = current
    ? current.name
    : "No model";

  return (
    <SectionShell
      id="s-model"
      number="02"
      label="Model"
      title="Pick the model doing the coding."
      description="Different models trade off accuracy, latency, and cost. Claude Sonnet 4.6 is a strong default — it's fast and nuanced enough for most conflict schemes. Use Opus for ambiguous, low-frequency categories; Haiku for simple binary coding at scale."
      cardTitle="Model"
      cardMeta={meta}
      state={stepDone[1] ? "done" : "idle"}
    >
      <div className={s.wrap}>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={s.selectedModel}
        >
          {current ? (
            <ModelLine model={current} variant="selected" />
          ) : (
            <div className={s.noModel}>Click to select a model</div>
          )}
        </button>

        <div className={s.keyStack}>
          <div className={s.keyBlock}>
            <div className={s.keyLabelRow}>
              <span className={s.keyLabel}>
                {activeKey.name.toUpperCase()} API KEY
              </span>
              <span
                className={`${s.keyStatus} ${
                  activeKey.value ? s.keyStatus_ok : s.keyStatus_warn
                }`}
              >
                {activeKey.value ? "Saved in this browser" : "Required to run"}
              </span>
            </div>
            <div className={s.keyRow}>
              <input
                type={shown ? "text" : "password"}
                className={s.keyInput}
                value={activeKey.value}
                onChange={(e) => activeKey.setValue(e.target.value)}
                placeholder={activeKey.placeholder}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShown((v) => !v)}
                className={s.keyToggle}
                aria-label={shown ? "Hide key" : "Show key"}
              >
                <EyeIcon open={shown} />
              </button>
            </div>
            <p className={s.keyHint}>
              Stored only in this browser and sent directly to {activeKey.name}{" "}
              when you run — never saved on our servers.
            </p>
          </div>
        </div>

        {pickerOpen && (
          <div className={s.picker}>
            <div className={s.filterRow}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.filterIcon}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Filter models…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={s.filterInput}
                autoFocus
              />
            </div>

            <div className={s.groups}>
              {byProvider.map(({ provider, models }) => (
                <div key={provider.id} className={s.group}>
                  <div className={s.groupHead}>
                    <span
                      className={s.providerIcon}
                      style={{
                        background: `${provider.accent}18`,
                        color: provider.accent,
                      }}
                    >
                      <ProviderIcon id={provider.id} />
                    </span>
                    <span className={s.providerName}>{provider.name}</span>
                    {provider.comingSoon && (
                      <span className={s.comingSoonChip}>COMING SOON</span>
                    )}
                  </div>
                  <div className={s.modelList}>
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        disabled={m.comingSoon}
                        onClick={() => {
                          if (m.comingSoon) return;
                          setSelectedModel(m.id);
                          setPickerOpen(false);
                        }}
                        className={`${s.modelRow} ${selectedModel === m.id ? s.modelRowSelected : ""} ${m.comingSoon ? s.modelRowDisabled : ""}`}
                      >
                        <ModelLine model={m} variant="picker" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {byProvider.length === 0 && (
                <div className={s.noMatch}>No models match &quot;{filter}&quot;</div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

function ModelLine({
  model,
  variant,
}: {
  model: ModelDef;
  variant: "selected" | "picker";
}) {
  const provider = PROVIDERS.find((p) => p.id === model.provider);
  return (
    <div className={s.modelLine}>
      <span
        className={s.modelIcon}
        style={{
          background: provider ? `${provider.accent}18` : undefined,
          color: provider?.accent,
        }}
      >
        {provider && <ProviderIcon id={provider.id} />}
      </span>
      <div className={s.modelMain}>
        <div className={s.modelTitleRow}>
          <span className={s.modelName}>{model.name}</span>
          {model.badge && (
            <span className={`${s.badge} ${s[`badge_${model.badge}`]}`}>
              {model.badge}
            </span>
          )}
        </div>
        {variant === "picker" ? (
          <div className={s.modelDesc}>{model.desc}</div>
        ) : (
          <div className={s.modelDescSmall}>{model.desc}</div>
        )}
      </div>
      <div className={s.modelPricing}>
        {model.pricing ? (
          <>
            <div className={s.price}>${model.pricing.inputPer1M} / M tok</div>
            <div className={s.latency}>{formatLatency(model.latency)}</div>
          </>
        ) : (
          <div className={s.priceTbd}>Coming soon</div>
        )}
      </div>
    </div>
  );
}
