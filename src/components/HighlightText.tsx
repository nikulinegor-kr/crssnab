import React from "react";

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

  const query = searchQuery.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(query);

  if (index === -1) {
    return <span className={className}>{text}</span>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + searchQuery.length);
  const after = text.slice(index + searchQuery.length);

  return (
    <span className={className}>
      {before}
      <mark className="bg-yellow-300 dark:bg-yellow-600 text-foreground px-0.5 rounded-sm">
        {match}
      </mark>
      {after}
    </span>
  );
};
