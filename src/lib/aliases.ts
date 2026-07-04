import type { AliasItem } from "../types/terminal";

/** First version: alias func must be `cd <path>`. */
export function isCdAlias(func: string): boolean {
  const trimmed = func.trim();
  if (!/^cd\s+/i.test(trimmed)) return false;
  return trimmed.slice(3).trim().length > 0;
}

export function findAlias(
  aliases: AliasItem[],
  name: string,
): AliasItem | undefined {
  const trimmed = name.trim();
  return aliases.find(
    (a) => a.name === trimmed && isCdAlias(a.func),
  );
}
