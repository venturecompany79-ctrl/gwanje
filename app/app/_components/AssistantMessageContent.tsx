import { Fragment, type ReactNode } from "react";

type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "unordered"; items: string[] }
  | { type: "ordered"; items: string[] };

function inlineContent(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${index}-${part.slice(2, 12)}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${index}-${part.slice(0, 10)}`}>{part}</Fragment>
    ),
  );
}

function messageBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];

  for (const rawLine of text.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const listType = unordered ? "unordered" : ordered ? "ordered" : null;
    const listItem = unordered?.[1] ?? ordered?.[1];
    if (listType && listItem) {
      const previous = blocks.at(-1);
      if (previous?.type === listType) previous.items.push(listItem);
      else blocks.push({ type: listType, items: [listItem] });
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/)?.[1];
    blocks.push({
      type: heading ? "heading" : "paragraph",
      text: heading ?? line,
    });
  }

  return blocks;
}

export function AssistantMessageContent({
  text,
  pending,
}: {
  text: string;
  pending?: boolean;
}) {
  const blocks = messageBlocks(text);
  return (
    <div className="assistant-message-content">
      {blocks.map((block, index) => {
        if (block.type === "unordered" || block.type === "ordered") {
          const List = block.type === "ordered" ? "ol" : "ul";
          return (
            <List key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item.slice(0, 16)}`}>{inlineContent(item)}</li>
              ))}
            </List>
          );
        }
        return block.type === "heading" ? (
          <h3 key={`${block.type}-${index}`}>{inlineContent(block.text)}</h3>
        ) : (
          <p key={`${block.type}-${index}`}>{inlineContent(block.text)}</p>
        );
      })}
      {pending ? <span className="assistant-typing" aria-label="답변 작성 중" /> : null}
    </div>
  );
}
