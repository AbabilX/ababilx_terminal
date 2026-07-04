import type { TerminalTab } from "../types/terminal";

const FLOWER_NAMES = [
  "Rose",
  "Tulip",
  "Lily",
  "Daisy",
  "Orchid",
  "Jasmine",
  "Marigold",
  "Lotus",
  "Iris",
  "Poppy",
  "Peony",
  "Dahlia",
  "Camellia",
  "Hibiscus",
  "Magnolia",
  "Azalea",
  "Zinnia",
  "Violet",
  "Sunflower",
  "Lavender",
];

function randomFlowerName(): string {
  return FLOWER_NAMES[Math.floor(Math.random() * FLOWER_NAMES.length)];
}

export function newTab(): TerminalTab {
  return {
    id: crypto.randomUUID(),
    title: randomFlowerName(),
    panes: [crypto.randomUUID()],
  };
}
