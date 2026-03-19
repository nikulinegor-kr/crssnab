import React from "react";
import { findHighlightRanges } from "@/lib/materialSearch";

interface HighlightTextProps {
  text: string;
  searchQuery: string;
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  searchQuery,
  className = "",
}) => {
  if (!searchQuery || !text) {
    return <span className={className}>{text}</span>;
  }

  const ranges = findHighlightRanges(text, searchQuery);

  if (ranges.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const [start, end] of ranges) {
    if (start > lastEnd) {
      parts.push(text.slice(lastEnd, start));
    }
    parts.push(
      <mark key={start} className="bg-yellow-300 dark:bg-yellow-600 text-foreground px-0.5 rounded-sm">
        {text.slice(start, end)}
      </mark>
    );
    lastEnd = end;
  }

  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }

  return <span className={className}>{parts}</span>;
};
