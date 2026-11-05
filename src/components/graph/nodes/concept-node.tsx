import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Brain } from "lucide-react";

export type ConceptNodeType = Node<{
  id: string;
  label: string;
  courseCount?: number;
  docCount?: number;
  description?: string | null;
}>;

export const ConceptNode = memo(({ data, selected }: NodeProps<ConceptNodeType>) => {
  return (
    <div
      className={`group relative min-w-44 max-w-56 rounded border bg-card p-3 font-mono shadow-sm transition-all duration-150 ${
        selected
          ? "border-foreground ring-1 ring-foreground"
          : "border-border hover:border-neutral-400 dark:hover:border-neutral-600"
      }`}
    >
      <Handle
        type="target"
        id="concept-bottom"
        position={Position.Bottom}
        className="h-2 w-2 rounded-full border border-background bg-foreground"
      />
      <Handle
        type="source"
        id="concept-top"
        position={Position.Top}
        className="h-2 w-2 rounded-full border border-background bg-foreground"
      />

      <div className="flex items-center space-x-2 border-b border-border/60 pb-1.5 mb-1.5">
        <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate">
          {data.label}
        </span>
      </div>

      {data.description && (
        <p className="text-[10px] text-muted-foreground font-sans line-clamp-2 mb-1.5">
          {data.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{data.courseCount ?? 1} COURSES</span>
        <span>{data.docCount ?? 0} DOCS</span>
      </div>
    </div>
  );
});

ConceptNode.displayName = "ConceptNode";
