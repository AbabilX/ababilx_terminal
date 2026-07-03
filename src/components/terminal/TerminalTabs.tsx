import { useTerminalStore } from "../../store/terminal";

export default function TerminalTabs() {
  const { tabs, activeId, addTab, closeTab, setActive } = useTerminalStore();

  return (
    <div className="flex h-9 items-center gap-1 bg-[#010409] px-2">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActive(tab.id)}
          className={`group flex h-7 cursor-pointer items-center gap-2 rounded px-3 text-xs ${
            tab.id === activeId
              ? "bg-[#0d1117] text-gray-100"
              : "text-gray-400 hover:bg-[#161b22]"
          }`}
        >
          <span>{tab.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="rounded px-1 text-gray-500 opacity-0 hover:bg-[#30363d] hover:text-gray-200 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addTab}
        className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-[#161b22] hover:text-gray-100"
        title="New tab (Ctrl+T)"
      >
        +
      </button>
    </div>
  );
}
