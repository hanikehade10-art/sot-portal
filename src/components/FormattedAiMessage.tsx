import React from 'react';

interface FormattedAiMessageProps {
  content: string;
}

export const FormattedAiMessage: React.FC<FormattedAiMessageProps> = ({ content }) => {
  // Parse inline formatting: **bold** and `code`
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-[#FFC700]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-[#0A1224] text-[#60A5FA] text-[11px] border border-[#24315A]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'bullet' | 'number'; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    if (currentList.type === 'bullet') {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-1">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] mt-1.5 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`list-${elements.length}`} className="my-2 space-y-1 pl-1">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="text-[#FFC700] font-bold shrink-0">{idx + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    // Headings: ###, ##, #
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={idx} className="font-heading font-bold text-sm text-[#FFC700] mt-3 mb-1">
          {renderInline(line.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="font-heading font-bold text-base text-[#E6ECFA] mt-3 mb-1 border-b border-[#24315A]/70 pb-1">
          {renderInline(line.replace(/^#{1,2}\s+/, ''))}
        </h3>
      );
      return;
    }

    // Bullet points: * or -
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const text = line.replace(/^[*-]\s+/, '');
      if (currentList && currentList.type === 'bullet') {
        currentList.items.push(text);
      } else {
        flushList();
        currentList = { type: 'bullet', items: [text] };
      }
      return;
    }

    // Numbered list: 1. or 2.
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      const text = numMatch[1];
      if (currentList && currentList.type === 'number') {
        currentList.items.push(text);
      } else {
        flushList();
        currentList = { type: 'number', items: [text] };
      }
      return;
    }

    // Regular paragraph line
    flushList();
    elements.push(
      <p key={idx} className="text-xs leading-relaxed my-1">
        {renderInline(line)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
};
