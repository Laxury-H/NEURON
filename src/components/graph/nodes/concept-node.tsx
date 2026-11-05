import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Brain, Filter } from "lucide-react";

export type ConceptNodeData = {
  id: string;
  label: string;
  courseCount?: number;
  docCount?: number;
  description?: string | null;
  isSelected?: boolean;
  onFilterClick?: (label: string) => void;
};

export type ConceptNodeType = Node<ConceptNodeData>;

export const ConceptNode = memo(({ data, selected }: NodeProps<ConceptNodeType>) => {
  const isSelected = selected || data.isSelected;

  const handleFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onFilterClick) {
      data.onFilterClick(data.label);
    }
  };

  return (
    <div
      className={`group relative min-w-48 max-w-60 rounded-md border bg-card p-3 font-mono shadow-sm transition-all duration-150 select-none ${
        isSelected
          ? "border-foreground ring-1 ring-foreground"
          : "border-border hover:border-neutral-400 dark:hover:border-neutral-600"
      }`}
    >
      {/* 4 Cardinal Handles: Top, Bottom, Left, Right with monochrome styling */}
      <Handle
        type="source"
        id="concept-top"
        position={Position.Top}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full"
      />
      <Handle
        type="target"
        id="concept-top-target"
        position={Position.Top}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full opacity-0 pointer-events-none"
      />

      <Handle
        type="target"
        id="concept-bottom"
        position={Position.Bottom}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full"
      />
      <Handle
        type="source"
        id="concept-bottom-source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full opacity-0 pointer-events-none"
      />

      <Handle
        type="target"
        id="concept-left"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full"
      />
      <Handle
        type="source"
        id="concept-left-source"
        position={Position.Left}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full opacity-0 pointer-events-none"
      />

      <Handle
        type="source"
        id="concept-right"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full"
      />
      <Handle
        type="target"
        id="concept-right-target"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-foreground border border-background rounded-full opacity-0 pointer-events-none"
      />

      {/* Header: Concept Icon, Label & Interactive Filter Trigger */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-1.5 gap-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate">
            {data.label}
          </span>
        </div>

        {/* Filter Trigger Badge/Button */}
        <button
          type="button"
          onClick={handleFilterClick}
          title={`Filter graph by concept "${data.label}"`}
          className="inline-flex items-center rounded border border-border/80 px-1 py-0.5 text-[8px] font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
          <Filter className="h-2.5 w-2.5 mr-0.5 shrink-0" />
          Filter
        </button>
      </div>

      {data.description && (
        <p className="text-[10px] text-muted-foreground font-sans line-clamp-2 mb-1.5">
          {data.description}
        </p>
      )}

      {/* Dynamic Occurrence Badges */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-0.5 border-t border-border/40 font-mono">
        <span className="font-medium">{data.courseCount ?? 1} COURSES</span>
        <span className="font-medium">{data.docCount ?? 0} DOCS</span>
      </div>
    </div>
  );
});

ConceptNode.displayName = "ConceptNode";
