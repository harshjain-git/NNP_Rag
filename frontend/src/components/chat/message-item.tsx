"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import type { Message, Citation } from "@/types";
import { DocumentIcon } from "@/components/ui/icons";
import { CitationBadge } from "./citation-badge";

interface MessageItemProps {
  message: Message;
  onSelectCitation?: (citation: Citation) => void;
  activeCitationId?: string | null;
}

/**
 * Normalizes escaped markdown formatting delimiters (such as \*\* for bold) outside of code blocks.
 * Preserves code blocks, LaTeX symbols, Windows file paths, and standard backslashes.
 */
export function normalizeMarkdown(content: string): string {
  if (!content) return "";

  // Split by code blocks (fenced ```...``` and inline `...`)
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*?`)/g);

  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i];
    if (!text) continue;

    parts[i] = text
      // Normalize escaped asterisks for bold/italic (e.g., \*\*bold\*\* -> **bold**, \\*\\* -> **)
      .replace(/\\+(\*)/g, "$1")
      // Normalize escaped underscores for bold/italic (e.g., \_\_bold\_\_ -> __bold__)
      .replace(/\\+(_)/g, "$1")
      // Normalize escaped heading markers at line start (e.g., \# Heading -> # Heading)
      .replace(/(^|\n)\\+(#{1,6}\s)/g, "$1$2")
      // Normalize escaped list bullets at line start (e.g., \* bullet -> * bullet, \- bullet -> - bullet)
      .replace(/(^|\n)\s*\\+([*-]\s)/g, "$1$2")
      // Normalize escaped citation brackets (e.g., \[Source 1\] -> [Source 1])
      .replace(/\\*\[(Source\s+\d+)\\*\]/gi, "[$1]");
  }

  return parts.join("");
}

export function MessageItem({
  message,
  onSelectCitation,
  activeCitationId,
}: MessageItemProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl bg-[#2f2f2f] text-zinc-100 px-4 py-3 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words border border-zinc-700/40 shadow-xs">
          {message.content}
        </div>
      </div>
    );
  }

  const citations: Citation[] = message.citations || [];
  const isInsufficientEvidence =
    message.content.toLowerCase().includes("could not find sufficient evidence") ||
    message.content.startsWith("INSUFFICIENT_EVIDENCE:");

  const renderTextWithCitations = (children: React.ReactNode): React.ReactNode => {
    if (typeof children !== "string") {
      if (Array.isArray(children)) {
        return children.map((child, i) => (
          <React.Fragment key={i}>{renderTextWithCitations(child)}</React.Fragment>
        ));
      }
      return children;
    }

    const citationRegex = /\[Source\s+(\d+)\]/gi;
    if (!citationRegex.test(children)) {
      return children;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    citationRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(children)) !== null) {
      if (match.index > lastIndex) {
        parts.push(children.slice(lastIndex, match.index));
      }

      const sourceNum = Number.parseInt(match[1] || "", 10);
      const matchingCitation =
        !Number.isNaN(sourceNum) && sourceNum >= 1 && sourceNum <= citations.length
          ? citations[sourceNum - 1]
          : null;

      const isActive = matchingCitation && activeCitationId === matchingCitation.chunkId;

      parts.push(
        <button
          key={`inline-cite-${match.index}-${sourceNum}`}
          type="button"
          onClick={() => matchingCitation && onSelectCitation?.(matchingCitation)}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono font-medium cursor-pointer transition-colors align-baseline ${
            isActive
              ? "bg-blue-900/80 border border-blue-400 text-blue-200 shadow-xs"
              : "bg-blue-950/50 hover:bg-blue-900/60 border border-blue-700/60 text-blue-300 hover:text-blue-100"
          }`}
          title={
            matchingCitation
              ? `Inspect Source ${sourceNum}: ${matchingCitation.filename}${
                  matchingCitation.pageNumber ? ` (p. ${matchingCitation.pageNumber})` : ""
                }`
              : `Source ${sourceNum}`
          }
        >
          [Source {sourceNum}]
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < children.length) {
      parts.push(children.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="flex flex-col w-full text-zinc-100 space-y-3">
      {/* Insufficient Evidence Warning Banner */}
      {isInsufficientEvidence && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Insufficient Evidence • Grounding Safeguard Triggered</span>
        </div>
      )}

      {/* Assistant Answer Body */}
      <div className="text-sm sm:text-base text-zinc-200 leading-relaxed break-words px-1 space-y-2">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-zinc-100 mt-4 mb-2 first:mt-0">
                {renderTextWithCitations(children)}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-zinc-100 mt-3 mb-2 first:mt-0">
                {renderTextWithCitations(children)}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-zinc-200 mt-3 mb-1.5 first:mt-0">
                {renderTextWithCitations(children)}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-sm font-semibold text-zinc-300 mt-2 mb-1 first:mt-0">
                {renderTextWithCitations(children)}
              </h4>
            ),
            p: ({ children }) => (
              <p className="my-2 leading-relaxed text-zinc-200 first:mt-0 last:mb-0">
                {renderTextWithCitations(children)}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 my-2 space-y-1 text-zinc-200">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 my-2 space-y-1 text-zinc-200">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed text-zinc-200">
                {renderTextWithCitations(children)}
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-zinc-100">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-zinc-300">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400 italic">
                {renderTextWithCitations(children)}
              </blockquote>
            ),
            pre: ({ children }) => (
              <pre className="bg-[#262626] border border-zinc-700/60 rounded-xl p-3 my-2.5 overflow-x-auto text-xs sm:text-sm font-mono text-zinc-200">
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isInline =
                !className &&
                typeof children === "string" &&
                !children.includes("\n");
              if (!isInline) {
                return (
                  <code className="text-xs sm:text-sm font-mono text-zinc-200" {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="bg-[#262626] text-zinc-200 px-1.5 py-0.5 rounded text-xs sm:text-sm font-mono border border-zinc-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            hr: () => <hr className="my-3 border-zinc-800" />,
            table: ({ children }) => (
              <div className="overflow-x-auto my-3">
                <table className="border-collapse border border-zinc-700 text-xs sm:text-sm w-full">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-left font-semibold text-zinc-200">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-zinc-700 px-3 py-1.5 text-zinc-300">
                {children}
              </td>
            ),
          }}
        >
          {normalizeMarkdown(message.content)}
        </ReactMarkdown>
      </div>

      {/* Verified Sources / Citations Section */}
      {citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <DocumentIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Sources ({citations.length})</span>
            <span className="text-[10px] text-zinc-500 font-normal lowercase">
              • click to inspect excerpt
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {citations.map((citation, idx) => (
              <CitationBadge
                key={`${citation.chunkId}-${idx}`}
                citation={citation}
                index={idx + 1}
                onClick={() => onSelectCitation?.(citation)}
                isActive={activeCitationId === citation.chunkId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
