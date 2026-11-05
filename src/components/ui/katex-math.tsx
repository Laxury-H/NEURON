"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface KatexMathProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export function KatexMath({
  math,
  displayMode = true,
  className = "",
}: KatexMathProps) {
  const html = useMemo(() => {
    if (!math || typeof math !== "string") return null;

    // Clean leading/trailing markdown code ticks or math dollar signs if present
    const cleaned = math
      .replace(/^```(latex|math)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .replace(/^\$\$|\$\$$/g, "")
      .replace(/^\$|\$$/g, "")
      .trim();

    try {
      return katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return null;
    }
  }, [math, displayMode]);

  if (!html) {
    return <code className={`font-mono text-xs ${className}`}>{math}</code>;
  }

  return (
    <div
      className={`katex-render text-foreground overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
