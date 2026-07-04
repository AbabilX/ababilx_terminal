import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

import { isCdAlias } from "../../lib/aliases";
import type { AliasItem } from "../../types/terminal";
import { TextInput } from "./SettingsField";

interface AliasListEditorProps {
  aliases: AliasItem[];
  onChange: (aliases: AliasItem[]) => void;
}

export function AliasListEditor({ aliases, onChange }: AliasListEditorProps) {
  const update = (index: number, patch: Partial<AliasItem>) => {
    onChange(aliases.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  const remove = (index: number) => {
    onChange(aliases.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...aliases, { name: "", func: "cd " }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {aliases.length === 0 && (
        <p className="text-xs text-gray-500">No aliases yet. Add one below.</p>
      )}
      {aliases.map((alias, i) => {
        const invalid = alias.func.trim() !== "" && !isCdAlias(alias.func);
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
          >
            <TextInput
              value={alias.name}
              onChange={(name) => update(i, { name })}
              placeholder="name"
              className="w-28 font-mono text-xs"
            />
            <TextInput
              value={alias.func}
              onChange={(func) => update(i, { func })}
              placeholder="cd /path"
              className="min-w-[200px] flex-1 font-mono text-xs"
            />
            {invalid && (
              <span className="text-xs text-red-400">Must be cd command</span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-white/[0.06] hover:text-red-400"
              aria-label="Remove alias"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
        Add alias
      </button>
    </div>
  );
}
