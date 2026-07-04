const TAB_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
  "#f472b6",
];

interface TabContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onSetColor: (color: string) => void;
  onResetColor: () => void;
  onClose: () => void;
}

export function TabContextMenu({
  x,
  y,
  onRename,
  onSetColor,
  onResetColor,
  onClose,
}: TabContextMenuProps) {
  return (
    <div
      className="fixed z-50 w-48 rounded-lg border border-white/10 bg-[#111827]/95 p-2 text-xs text-gray-200 shadow-xl backdrop-blur"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/10"
        onClick={() => {
          onClose();
          onRename();
        }}
      >
        Rename
      </button>
      <div className="mt-2 border-t border-white/10 pt-2">
        <p className="mb-2 px-1 text-[11px] uppercase tracking-wide text-gray-500">
          Border color
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {TAB_COLORS.map((color) => (
            <button
              key={color}
              className="h-6 rounded-md border border-white/10 transition-transform hover:scale-105"
              style={{ backgroundColor: color }}
              onClick={() => {
                onSetColor(color);
                onClose();
              }}
              aria-label={`Set tab border color ${color}`}
            />
          ))}
        </div>
        <button
          className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          onClick={() => {
            onResetColor();
            onClose();
          }}
        >
          Reset color
        </button>
      </div>
    </div>
  );
}
