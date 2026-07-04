import { useCallback, useEffect, useRef, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { isCdAlias } from "../../lib/aliases";
import { openSettingsFile, useSettingsStore } from "../../store/settings";
import type { AppSettings } from "../../types/terminal";
import { WindowControls } from "../header/WindowControls";
import { AliasListEditor } from "./AliasListEditor";
import { KeybindingInput } from "./KeybindingInput";
import {
  NumberInput,
  SelectInput,
  SettingsField,
  TextInput,
  ToggleInput,
} from "./SettingsField";

interface SettingsPageProps {
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-medium text-gray-100">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasIncompleteAlias = useCallback((aliases: AppSettings["aliases"]) => {
    return aliases.some((a) => !a.name.trim() || !isCdAlias(a.func));
  }, []);

  useEffect(() => {
    setDraft((prev) => {
      const incomplete = prev.aliases.filter(
        (a) => !a.name.trim() || !isCdAlias(a.func),
      );
      if (incomplete.length === 0) return settings;
      return { ...settings, aliases: [...settings.aliases, ...incomplete] };
    });
    setError(null);
  }, [settings]);

  const persist = useCallback(
    async (next: AppSettings) => {
      const validAliases = next.aliases.filter(
        (a) => a.name.trim() && isCdAlias(a.func),
      );
      const names = new Set<string>();
      for (const a of validAliases) {
        if (names.has(a.name.trim())) {
          setError(`Duplicate alias name: ${a.name}`);
          return;
        }
        names.add(a.name.trim());
      }

      const payload = { ...next, aliases: validAliases };
      setSaving(true);
      setError(null);
      try {
        await save(payload);
      } catch (err) {
        setError(String(err));
      } finally {
        setSaving(false);
      }
    },
    [save],
  );

  const patch = useCallback(
    (patchFn: (prev: AppSettings) => AppSettings) => {
      setDraft((prev) => {
        const next = patchFn(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (!hasIncompleteAlias(next.aliases)) {
          saveTimer.current = setTimeout(() => persist(next), 400);
        }
        return next;
      });
    },
    [persist, hasIncompleteAlias],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-background)]">
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-gray-400 hover:bg-white/[0.06] hover:text-gray-100"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            Back
          </button>
          <h1 className="text-lg font-medium text-gray-100">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-500">Saving…</span>}
          <button
            type="button"
            onClick={() => openSettingsFile()}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white"
          >
            Open settings.json
          </button>
          <WindowControls showSettingsButton={false} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">
          {error && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <Section title="Appearance">
            <SettingsField label="Theme" description="Terminal color palette">
              <SelectInput
                value={draft.appearance.theme}
                onChange={(theme) =>
                  patch((s) => ({ ...s, appearance: { ...s.appearance, theme } }))
                }
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
              />
            </SettingsField>
            <SettingsField label="Background" description="Window background hex">
              <TextInput
                value={draft.appearance.background}
                onChange={(background) =>
                  patch((s) => ({
                    ...s,
                    appearance: { ...s.appearance, background },
                  }))
                }
                className="w-32 font-mono text-xs"
              />
            </SettingsField>
            <SettingsField label="Opacity" description="0–1">
              <NumberInput
                value={draft.appearance.opacity}
                onChange={(opacity) =>
                  patch((s) => ({
                    ...s,
                    appearance: { ...s.appearance, opacity },
                  }))
                }
                min={0}
                max={1}
                step={0.01}
              />
            </SettingsField>
            <SettingsField label="Blur" description="Background blur in px (0 = off)">
              <NumberInput
                value={draft.appearance.blur}
                onChange={(blur) =>
                  patch((s) => ({
                    ...s,
                    appearance: { ...s.appearance, blur },
                  }))
                }
                min={0}
                max={64}
                step={1}
              />
            </SettingsField>
          </Section>

          <Section title="Terminal">
            <SettingsField label="Font family">
              <TextInput
                value={draft.terminal.fontFamily}
                onChange={(fontFamily) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, fontFamily },
                  }))
                }
                className="w-64 text-xs"
              />
            </SettingsField>
            <SettingsField label="Font size">
              <NumberInput
                value={draft.terminal.fontSize}
                onChange={(fontSize) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, fontSize },
                  }))
                }
                min={8}
                max={32}
                step={1}
              />
            </SettingsField>
            <SettingsField
              label="Text color"
              description='Use "auto" for theme default'
            >
              <TextInput
                value={draft.terminal.foreground}
                onChange={(foreground) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, foreground },
                  }))
                }
                className="w-32 font-mono text-xs"
              />
            </SettingsField>
            <SettingsField label="Cursor style">
              <SelectInput
                value={draft.terminal.cursorStyle}
                onChange={(cursorStyle) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, cursorStyle },
                  }))
                }
                options={[
                  { value: "block", label: "Block" },
                  { value: "underline", label: "Underline" },
                  { value: "bar", label: "Bar" },
                ]}
              />
            </SettingsField>
            <SettingsField label="Cursor blink">
              <ToggleInput
                checked={draft.terminal.cursorBlink}
                onChange={(cursorBlink) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, cursorBlink },
                  }))
                }
              />
            </SettingsField>
            <SettingsField label="Line height">
              <NumberInput
                value={draft.terminal.lineHeight}
                onChange={(lineHeight) =>
                  patch((s) => ({
                    ...s,
                    terminal: { ...s.terminal, lineHeight },
                  }))
                }
                min={1}
                max={3}
                step={0.1}
              />
            </SettingsField>
          </Section>

          <Section title="Keybindings">
            <SettingsField label="New tab">
              <KeybindingInput
                value={draft.keybindings.newTab}
                onChange={(newTab) =>
                  patch((s) => ({
                    ...s,
                    keybindings: { ...s.keybindings, newTab },
                  }))
                }
              />
            </SettingsField>
            <SettingsField label="Split right">
              <KeybindingInput
                value={draft.keybindings.splitRight}
                onChange={(splitRight) =>
                  patch((s) => ({
                    ...s,
                    keybindings: { ...s.keybindings, splitRight },
                  }))
                }
              />
            </SettingsField>
            <SettingsField label="Close tab">
              <KeybindingInput
                value={draft.keybindings.closeTab}
                onChange={(closeTab) =>
                  patch((s) => ({
                    ...s,
                    keybindings: { ...s.keybindings, closeTab },
                  }))
                }
              />
            </SettingsField>
            <SettingsField label="Open settings">
              <KeybindingInput
                value={draft.keybindings.settings}
                onChange={(settings) =>
                  patch((s) => ({
                    ...s,
                    keybindings: { ...s.keybindings, settings },
                  }))
                }
              />
            </SettingsField>
          </Section>

          <Section title="Aliases">
            <p className="mb-3 text-xs text-gray-500">
              Type the alias name and press Enter to run its cd command.
            </p>
            <AliasListEditor
              aliases={draft.aliases}
              onChange={(aliases) => patch((s) => ({ ...s, aliases }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
