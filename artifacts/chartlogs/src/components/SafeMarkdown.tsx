import React from "react";

interface Token {
  type: "h1" | "h2" | "h3" | "h4" | "paragraph" | "br";
  children: InlineToken[];
}

interface InlineToken {
  type: "bold" | "text" | "numbered";
  text: string;
  num?: string;
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const boldRe = /\*\*(.+?)\*\*/g;
  const numberedRe = /^(\d+)\. (.+)$/;

  const numberedMatch = text.match(numberedRe);
  if (numberedMatch) {
    tokens.push({ type: "numbered", text: numberedMatch[2], num: numberedMatch[1] });
    return tokens;
  }

  let last = 0;
  let m: RegExpExecArray | null;
  boldRe.lastIndex = 0;
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", text: text.slice(last, m.index) });
    tokens.push({ type: "bold", text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens;
}

function renderInline(tokens: InlineToken[]): React.ReactNode[] {
  return tokens.map((t, i) => {
    if (t.type === "bold") return <strong key={i} className="text-foreground">{t.text}</strong>;
    if (t.type === "numbered") return (
      <React.Fragment key={i}>
        <span className="text-blue-400 font-medium">{t.num}.</span> {t.text}
      </React.Fragment>
    );
    return <React.Fragment key={i}>{t.text}</React.Fragment>;
  });
}

function parseBlocks(text: string): Token[] {
  const tokens: Token[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      tokens.push({ type: "br", children: [] });
      continue;
    }
    const h4 = line.match(/^### (.+)$/);
    const h3 = line.match(/^## (.+)$/);
    const h2 = line.match(/^# (.+)$/);
    if (h2) { tokens.push({ type: "h1", children: parseInline(h2[1]) }); continue; }
    if (h3) { tokens.push({ type: "h2", children: parseInline(h3[1]) }); continue; }
    if (h4) { tokens.push({ type: "h3", children: parseInline(h4[1]) }); continue; }
    tokens.push({ type: "paragraph", children: parseInline(line) });
  }
  return tokens;
}

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className = "" }: SafeMarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return <h2 key={i} className="text-lg font-bold text-foreground mt-2 mb-2">{renderInline(block.children)}</h2>;
          case "h2":
            return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1.5">{renderInline(block.children)}</h3>;
          case "h3":
            return <h4 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{renderInline(block.children)}</h4>;
          case "br":
            return <div key={i} className="h-1" />;
          case "paragraph":
            return <p key={i} className="leading-relaxed">{renderInline(block.children)}</p>;
          default:
            return null;
        }
      })}
    </div>
  );
}
