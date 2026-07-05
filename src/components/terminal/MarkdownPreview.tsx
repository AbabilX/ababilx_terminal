import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const COMPONENTS = {
  h1: (p: React.ComponentProps<"h1">) => (
    <h1 className="mb-3 mt-5 text-xl font-semibold text-[var(--ui-text)]" {...p} />
  ),
  h2: (p: React.ComponentProps<"h2">) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold text-[var(--ui-text)]" {...p} />
  ),
  h3: (p: React.ComponentProps<"h3">) => (
    <h3 className="mb-2 mt-3 text-base font-semibold text-[var(--ui-text-secondary)]" {...p} />
  ),
  p: (p: React.ComponentProps<"p">) => (
    <p className="my-2 leading-relaxed text-[var(--ui-text-secondary)]" {...p} />
  ),
  a: (p: React.ComponentProps<"a">) => (
    <a
      className="text-[var(--ui-link)] underline hover:text-[var(--ui-link-hover)]"
      {...p}
    />
  ),
  ul: (p: React.ComponentProps<"ul">) => (
    <ul className="my-2 list-disc pl-6 text-[var(--ui-text-secondary)]" {...p} />
  ),
  ol: (p: React.ComponentProps<"ol">) => (
    <ol className="my-2 list-decimal pl-6 text-[var(--ui-text-secondary)]" {...p} />
  ),
  li: (p: React.ComponentProps<"li">) => <li className="my-0.5" {...p} />,
  blockquote: (p: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-2 border-l-2 border-[var(--ui-border)] pl-3 text-[var(--ui-text-muted)]"
      {...p}
    />
  ),
  code: (p: React.ComponentProps<"code">) => (
    <code
      className="rounded bg-[var(--ui-hover-strong)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--ui-code-inline-text)]"
      {...p}
    />
  ),
  pre: (p: React.ComponentProps<"pre">) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg bg-[var(--ui-code-bg)] p-3 font-mono text-sm text-[var(--ui-text-secondary)]"
      {...p}
    />
  ),
  hr: () => <hr className="my-4 border-[var(--ui-border)]" />,
  table: (p: React.ComponentProps<"table">) => (
    <table className="my-2 w-full border-collapse text-sm" {...p} />
  ),
  th: (p: React.ComponentProps<"th">) => (
    <th
      className="border border-[var(--ui-border)] bg-[var(--ui-table-header-bg)] px-2 py-1 text-left text-[var(--ui-text-secondary)]"
      {...p}
    />
  ),
  td: (p: React.ComponentProps<"td">) => (
    <td
      className="border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-text-secondary)]"
      {...p}
    />
  ),
};

/** Read-only formatted markdown body for the `see <file.md>` preview. */
export function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="max-h-[80vh] w-full overflow-auto px-6 py-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
