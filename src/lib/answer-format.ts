/*
 * The formatting of an answer of the entity, parsed into typed nodes the
 * panel renders as real structure: bold, lists, headings and working links,
 * by the director's order of 2026-08-21. This is a deterministic parser of a
 * closed subset, never a markdown engine: whatever is not in the subset stays
 * literal text, nothing here emits or interprets HTML, and only http and
 * https destinations become links, so a crafted answer can never inject
 * markup or a script scheme into the screen.
 */

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string };

export type AnswerBlock =
  | { kind: "heading"; inline: InlineNode[] }
  | { kind: "paragraph"; lines: InlineNode[][] }
  | { kind: "list"; ordered: boolean; items: InlineNode[][] };

const SAFE_LINK = /^https?:\/\//i;

/* Inline tokens, longest and most specific first: explicit link, bold,
 * italic, inline code, bare address. */
const INLINE_TOKEN =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|(?<![\w*])\*([^*\n]+)\*(?![\w*])|`([^`\n]+)`|https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push({ kind: "text", text: text.slice(cursor, index) });
    }
    const [whole, linkText, linkUrl, bold, boldUnder, italic, code] = match;
    if (linkText !== undefined && linkUrl !== undefined) {
      if (SAFE_LINK.test(linkUrl)) {
        nodes.push({ kind: "link", text: linkText, url: linkUrl });
      } else {
        /* A destination outside http and https stays visible words, never a
         * working link. */
        nodes.push({ kind: "text", text: `${linkText} (${linkUrl})` });
      }
    } else if (bold !== undefined) {
      nodes.push({ kind: "bold", text: bold });
    } else if (boldUnder !== undefined) {
      nodes.push({ kind: "bold", text: boldUnder });
    } else if (italic !== undefined) {
      nodes.push({ kind: "italic", text: italic });
    } else if (code !== undefined) {
      nodes.push({ kind: "code", text: code });
    } else {
      nodes.push({ kind: "link", text: whole, url: whole });
    }
    cursor = index + whole.length;
  }
  if (cursor < text.length) {
    nodes.push({ kind: "text", text: text.slice(cursor) });
  }
  return nodes;
}

const UNORDERED_ITEM = /^[ \t]*[-*][ \t]+(.*)$/;
const ORDERED_ITEM = /^[ \t]*\d{1,3}[.)][ \t]+(.*)$/;
const HEADING = /^#{1,6}[ \t]+(.*)$/;

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: InlineNode[][] = [];
  let list: { ordered: boolean; items: InlineNode[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list !== null) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(HEADING);
    if (heading?.[1] !== undefined) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", inline: parseInline(heading[1]) });
      continue;
    }
    const unordered = line.match(UNORDERED_ITEM);
    const ordered = unordered === null ? line.match(ORDERED_ITEM) : null;
    const item = unordered?.[1] ?? ordered?.[1];
    if (item !== undefined) {
      flushParagraph();
      const wantsOrdered = ordered !== null;
      if (list === null || list.ordered !== wantsOrdered) {
        flushList();
        list = { ordered: wantsOrdered, items: [] };
      }
      list.items.push(parseInline(item));
      continue;
    }
    flushList();
    paragraph.push(parseInline(line));
  }
  flushParagraph();
  flushList();
  return blocks;
}
