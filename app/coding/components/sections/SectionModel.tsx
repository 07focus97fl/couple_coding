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

function redactKey(k: string): string {
  if (!k) return "";
  if (k.length <= 11) return k;
  return `${k.slice(0, 7)}…${k.slice(-3)}`;
}

export function SectionModel() {
  const {
    selectedModel,
    setSelectedModel,
    apiKey,
    devSignedIn,
    setTweaksOpen,
    stepDone,
  } = useSession();
  const [filter, setFilter] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

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
        <div className={s.topRow}>
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
          <button
            type="button"
            onClick={() => setTweaksOpen(true)}
            className={s.keyChip}
            title="Open Tweaks to edit your key"
          >
            <div className={s.keyChipInner}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span className={s.keyChipCode}>
                {devSignedIn
                  ? "dev signed-in"
                  : apiKey
                  ? redactKey(apiKey)
                  : "no key"}
              </span>
            </div>
            <div className={s.keyChipSub}>
              {devSignedIn || apiKey
                ? "Session key · never persisted"
                : "Add a key in Tweaks"}
            </div>
          </button>
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
                <div className={s.noMatch}>No models match "{filter}"</div>
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
