/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { AccentTheme } from '../config/courseAccents';
import { Lightbulb, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FormattedLessonNotesProps {
  notes: string;
  theme: AccentTheme;
  fontSize: number; // in pixels, e.g. 17 or 18
}

interface TableData {
  headers: string[];
  rows: string[][];
}

/**
 * Parses markdown inline formatting (**bold**, *italic*, `code`, [link](url))
 */
export function renderInlineMarkdown(text: string, accentColorClass: string = 'text-[#FACC15]') {
  // Pattern matching **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-[#FFFFFF]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
      return (
        <em key={i} className="italic text-[#E8EEF8]">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#0B1220] border border-[#24315A] text-[#FACC15] font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Link [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-[#60A5FA] underline hover:text-[#93C5FD] transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={i}>{part}</span>;
  });
}

/**
 * Detects if lines form a markdown table
 */
function parseTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;
  const isPipeLine = (l: string) => l.trim().startsWith('|') || l.includes('|');
  if (!lines.every(isPipeLine)) return null;

  const cleanLine = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());

  // Check if second line is divider (e.g. |---|---|)
  const secondLine = lines[1].trim();
  const isDivider = /^\|?[\s-:]+(\|[\s-:]+)+\|?$/.test(secondLine);
  if (!isDivider) return null;

  const headers = cleanLine(lines[0]);
  const rows = lines.slice(2).map(cleanLine);
  return { headers, rows };
}

/**
 * Beautiful, calm study reader for lesson notes
 */
export const FormattedLessonNotes: React.FC<FormattedLessonNotesProps> = ({
  notes,
  theme,
  fontSize
}) => {
  const blocks = useMemo(() => {
    if (!notes || !notes.trim()) return [];
    return notes.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  }, [notes]);

  if (blocks.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-[#111A2E] border border-[#24315A] text-sm text-[#9FB0C8] italic text-center">
        Detailed lesson notes for this syllabus topic will be uploaded soon.
      </div>
    );
  }

  let headingCounter = 0;

  return (
    <div
      className="space-y-6 text-[#E8EEF8] max-w-[720px] mx-auto select-text"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: 1.7
      }}
    >
      {blocks.map((block, idx) => {
        const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (rawLines.length === 0) return null;

        // Clean stray bullet symbols before headings (e.g. "• ## Heading" -> "## Heading")
        const firstLineClean = rawLines[0].replace(/^[•\-\*]\s*(?=[#0-9])/, '');

        // 1. CALLOUTS (> Tip: ..., > Note: ..., > Remember: ..., or any > Blockquote)
        if (firstLineClean.startsWith('>')) {
          const calloutFullText = rawLines
            .map(l => l.replace(/^>\s*/, ''))
            .join(' ');

          const isTip = /^Tip[\s:]/i.test(calloutFullText);
          const isNote = /^Note[\s:]/i.test(calloutFullText);
          const isRemember = /^Remember[\s:]/i.test(calloutFullText);

          let calloutTitle = 'Insight';
          let borderClass = 'border-teal-500/60 bg-teal-950/30 text-teal-200';
          let Icon = Lightbulb;
          let iconColor = 'text-teal-400';

          if (isTip) {
            calloutTitle = 'Study Tip';
            borderClass = 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200';
            Icon = Lightbulb;
            iconColor = 'text-emerald-400';
          } else if (isNote) {
            calloutTitle = 'Note';
            borderClass = 'border-sky-500/60 bg-sky-950/30 text-sky-200';
            Icon = Info;
            iconColor = 'text-sky-400';
          } else if (isRemember) {
            calloutTitle = 'Remember';
            borderClass = 'border-amber-500/60 bg-amber-950/30 text-amber-200';
            Icon = AlertTriangle;
            iconColor = 'text-amber-400';
          } else {
            borderClass = `${theme.accentBorder} ${theme.accentBgSubtle} text-[#E8EEF8]`;
            iconColor = theme.accentText;
          }

          // Strip the prefix from content if desired
          const cleanBody = calloutFullText.replace(/^(?:Tip|Note|Remember)[\s:]+/i, '');

          return (
            <div
              key={idx}
              className={`p-4 sm:p-5 rounded-2xl border-l-4 ${borderClass} shadow-sm space-y-1.5 my-4`}
            >
              <div className="flex items-center gap-2 font-heading font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                <span className={iconColor}>{calloutTitle}</span>
              </div>
              <p className="leading-relaxed pl-1 text-[0.95em]">
                {renderInlineMarkdown(cleanBody, theme.accentText)}
              </p>
            </div>
          );
        }

        // 2. HEADINGS: #, ##, ###, or numbered like "1. Title"
        const isH1 = /^#\s+/.test(firstLineClean);
        const isH2 = /^##\s+/.test(firstLineClean);
        const isH3 = /^###\s+/.test(firstLineClean);
        const isNumberedHeading = /^\d+[\.\)]\s+[A-Z]/.test(firstLineClean) && rawLines.length === 1;

        if (isH1 || isH2 || isH3 || isNumberedHeading) {
          headingCounter += 1;
          const cleanText = firstLineClean
            .replace(/^#+\s*/, '')
            .replace(/^\d+[\.\)]\s*/, '');

          return (
            <div key={idx} className="pt-4 pb-2 border-b border-[#24315A]/60">
              <div className="flex items-baseline gap-2.5">
                <span className={`font-mono font-black text-sm sm:text-base ${theme.accentText}`}>
                  {headingCounter.toString().padStart(2, '0')}.
                </span>
                <h3
                  className={`font-heading font-black tracking-tight text-[#FFFFFF] ${
                    isH1 ? 'text-xl sm:text-2xl' : isH2 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                  }`}
                >
                  {cleanText}
                </h3>
              </div>
              {/* Short accent underline */}
              <div className={`mt-2 h-0.5 w-12 rounded-full ${theme.underline}`} />
            </div>
          );
        }

        // 3. TABLE
        const table = parseTable(rawLines);
        if (table) {
          return (
            <div key={idx} className="my-4 overflow-x-auto rounded-xl border border-[#24315A] bg-[#111A2E]">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#16223A] border-b border-[#24315A]">
                    {table.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className={`p-3 font-heading font-bold ${theme.accentText}`}
                      >
                        {renderInlineMarkdown(h, theme.accentText)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24315A]/60">
                  {table.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-[#0B1220]/40'}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-3 text-[#E8EEF8]">
                          {renderInlineMarkdown(cell, theme.accentText)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 4. BULLET LISTS
        const isBulletList = rawLines.every(l => /^[•\-\*]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={idx} className="space-y-2.5 pl-4 sm:pl-5 my-3">
              {rawLines.map((line, lIdx) => {
                const cleaned = line.replace(/^[•\-\*]\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg} shrink-0 mt-2.5`} />
                    <div className="flex-1 leading-relaxed">
                      {renderInlineMarkdown(cleaned, theme.accentText)}
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        }

        // 5. NUMBERED LISTS
        const isNumberedList = rawLines.every(l => /^\d+[\.\)]\s+/.test(l));
        if (isNumberedList) {
          return (
            <ol key={idx} className="space-y-2.5 pl-1 my-3">
              {rawLines.map((line, lIdx) => {
                const numMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
                const numStr = numMatch ? numMatch[1] : `${lIdx + 1}`;
                const textContent = numMatch ? numMatch[2] : line;

                return (
                  <li key={lIdx} className="flex items-start gap-2.5">
                    <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[#16223A] border border-[#24315A] ${theme.accentText} shrink-0 mt-0.5`}>
                      {numStr}
                    </span>
                    <div className="flex-1 leading-relaxed">
                      {renderInlineMarkdown(textContent, theme.accentText)}
                    </div>
                  </li>
                );
              })}
            </ol>
          );
        }

        // 6. STANDARD PARAGRAPHS
        return (
          <div key={idx} className="space-y-2">
            {rawLines.map((line, lineIdx) => (
              <p key={lineIdx} className="leading-relaxed">
                {renderInlineMarkdown(line, theme.accentText)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
};
