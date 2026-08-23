import type { AnswerBlock, InlineNode } from "@/lib/answer-format";
import { parseAnswer } from "@/lib/answer-format";

/*
 * The answer of the entity rendered as real structure: bold as bold, lists as
 * lists, headings as headings and links that open, by the director's order of
 * 2026-08-21. Every node comes from the deterministic parser, is rendered as
 * a React element and never as raw markup, and a link always opens in a new
 * tab with the opener severed.
 */

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.kind}-${index}`;
        if (node.kind === "bold") {
          return (
            <strong key={key} className="font-bold">
              {node.text}
            </strong>
          );
        }
        if (node.kind === "italic") {
          return <em key={key}>{node.text}</em>;
        }
        if (node.kind === "code") {
          return (
            <code
              key={key}
              className="rounded bg-card px-1 font-mono text-[0.85em]"
            >
              {node.text}
            </code>
          );
        }
        if (node.kind === "link") {
          return (
            <a
              key={key}
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              {node.text}
            </a>
          );
        }
        return <span key={key}>{node.text}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: AnswerBlock }) {
  if (block.kind === "heading") {
    return (
      <p className="font-bold">
        <Inline nodes={block.inline} />
      </p>
    );
  }
  if (block.kind === "list") {
    const items = block.items.map((item, index) => (
      /* Items of one parsed answer never reorder, so the position is the
       * identity of the row. */
      // biome-ignore lint/suspicious/noArrayIndexKey: static parsed content
      <li key={index}>
        <Inline nodes={item} />
      </li>
    ));
    return block.ordered ? (
      <ol className="list-decimal space-y-1 pl-5">{items}</ol>
    ) : (
      <ul className="list-disc space-y-1 pl-5">{items}</ul>
    );
  }
  return (
    <p>
      {block.lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static parsed content
        <span key={index} className="block">
          <Inline nodes={line} />
        </span>
      ))}
    </p>
  );
}

export function AnswerContent({ text }: { text: string }) {
  const blocks = parseAnswer(text);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink">
      {blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static parsed content
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
