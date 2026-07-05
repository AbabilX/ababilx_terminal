import type { TerminalTab } from "../../types/terminal";

function firstRealPane(tabs: TerminalTab[]): string | null {
  return tabs.find((tab) => !tab.splitGroup && tab.panes.length > 0)?.panes[0] ?? null;
}

export function firstPaneForActive(
  tabs: TerminalTab[],
  activeId: string | null,
): string | null {
  const activeTab = tabs.find((tab) => tab.id === activeId);
  if (!activeTab) return firstRealPane(tabs);

  if (activeTab.splitGroup) {
    return tabs.find((tab) => tab.groupId === activeTab.id && tab.panes.length > 0)
      ?.panes[0] ?? firstRealPane(tabs);
  }

  return activeTab.panes[0] ?? firstRealPane(tabs);
}

export function keepFocusedPane(
  tabs: TerminalTab[],
  activeId: string | null,
  focusedPaneId: string | null,
  removedPaneIds: string[],
): string | null {
  if (!focusedPaneId || removedPaneIds.includes(focusedPaneId)) {
    return firstPaneForActive(tabs, activeId);
  }

  return tabs.some((tab) => tab.panes.includes(focusedPaneId))
    ? focusedPaneId
    : firstPaneForActive(tabs, activeId);
}
