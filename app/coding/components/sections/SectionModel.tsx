"use client";

import { useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import {
  defaultModelForProvider,
  formatPrice,
  getModel,
  modelsByProvider,
  ModelDef,
  PROVIDERS,
  ProviderDef,
  ProviderId,
  REASONING_LEVELS,
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

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function SectionModel() {
  const {
    selectedModel,
    setSelectedModel,
    reasoningLevel,
    setReasoningLevel,
    activeProvider,
    apiKey,
    setApiKey,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    stepDone,
  } = useSession();
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null);
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

  const meta = current ? current.name : "No model";

  return (
    <SectionShell
      id="s-model"
      number="02"
      label="Model"
      title="Pick the model doing the coding."
      description="Different models trade off accuracy, latency, and cost. You choose which one does the coding — pick from Anthropic, OpenAI, or Google below, then add that provider's API key."
      cardTitle="Model"
      cardMeta={meta}
      state={stepDone[1] ? "done" : "idle"}
    >
      <div className={s.wrap}>
        <div className={s.selectedCard}>
          <div className={s.selectedLabel}>SELECTED</div>
          {current ? (
            <ModelLine model={current} />
          ) : (
            <div className={s.noModel}>Pick a model below</div>
          )}
          {current?.reasoning && (
            <div className={s.reasoningRow}>
              <span className={s.reasoningLabel}>Reasoning</span>
              <div className={s.reasoningSegs}>
                {REASONING_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setReasoningLevel(level)}
                    className={`${s.reasoningSeg} ${reasoningLevel === level ? s.reasoningSegActive : ""}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={s.dropdownStack}>
          {PROVIDERS.map((provider) => (
            <ProviderDropdown
              key={provider.id}
              provider={provider}
              isActive={current?.provider === provider.id}
              activeModelId={selectedModel}
              open={openProvider === provider.id}
              onToggle={() =>
                setOpenProvider((v) => (v === provider.id ? null : provider.id))
              }
              onSelect={(id) => {
                setSelectedModel(id);
                setOpenProvider(null);
              }}
            />
          ))}
        </div>

        {current && (
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
        )}
      </div>
    </SectionShell>
  );
}

function ProviderDropdown({
  provider,
  isActive,
  activeModelId,
  open,
  onToggle,
  onSelect,
}: {
  provider: ProviderDef;
  isActive: boolean;
  activeModelId: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const models = modelsByProvider(provider.id);
  // The trigger shows the active model when this provider owns it; otherwise it
  // previews this provider's default pick so the dropdown reads as a real choice.
  const shownModel = isActive
    ? getModel(activeModelId)
    : defaultModelForProvider(provider.id);

  return (
    <div className={s.dropdown}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`${s.dropdownTrigger} ${isActive ? s.dropdownActive : ""}`}
      >
        <span
          className={s.providerIcon}
          style={{ background: `${provider.accent}18`, color: provider.accent }}
        >
          <ProviderIcon id={provider.id} />
        </span>
        <div className={s.dropdownLabel}>
          <span className={s.providerName}>{provider.name}</span>
          <span className={s.dropdownModelName}>
            {shownModel ? shownModel.name : "No models yet"}
          </span>
        </div>
        {isActive && (
          <span className={s.activeCheck} style={{ color: provider.accent }}>
            <CheckIcon />
          </span>
        )}
        <span className={`${s.chevron} ${open ? s.chevronOpen : ""}`}>
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <div className={s.dropdownPanel}>
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={m.comingSoon}
              onClick={() => {
                if (m.comingSoon) return;
                onSelect(m.id);
              }}
              className={`${s.modelRow} ${activeModelId === m.id ? s.modelRowSelected : ""} ${m.comingSoon ? s.modelRowDisabled : ""}`}
            >
              <ModelLine model={m} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelLine({ model }: { model: ModelDef }) {
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
        <span className={s.modelName}>{model.name}</span>
      </div>
      <div className={s.modelPricing}>
        {model.pricing ? (
          <>
            <div className={s.priceRow}>
              <span className={s.priceLabel}>In</span>
              <span className={s.priceValue}>
                {formatPrice(model.pricing.inputPer1M)} / M
              </span>
            </div>
            <div className={s.priceRow}>
              <span className={s.priceLabel}>Out</span>
              <span className={s.priceValue}>
                {formatPrice(model.pricing.outputPer1M)} / M
              </span>
            </div>
          </>
        ) : (
          <div className={s.priceTbd}>Coming soon</div>
        )}
      </div>
    </div>
  );
}
