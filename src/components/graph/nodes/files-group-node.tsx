import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { FolderGit2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilesGroupData {
  count: number;
  expanded: boolean;
  onToggleExpand?: () => void;
}

export const FilesGroupNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FilesGroupData;
  const countStr = String(nodeData.count).padStart(2, "0");

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-3 rounded-md transition-all cursor-pointer select-none",
        "w-44 border",
        selected
          ? "border-neutral-900 ring-1 ring-neutral-900 bg-neutral-100 dark:border-white dark:ring-white dark:bg-neutral-800"
          : "border-border bg-card hover:border-neutral-500",
        "shadow-sm"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="opacity-0"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0"
      />

      <div className="flex items-center space-x-2 text-foreground">
        <FolderGit2 className="h-4 w-4" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider">
          Files
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between w-full pt-1 border-t border-border/60">
        <span className="font-mono text-[11px] text-muted-foreground font-semibold">
          {countStr} {nodeData.count === 1 ? "DOCUMENT" : "DOCUMENTS"}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onToggleExpand?.();
          }}
          className="flex items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono border border-border bg-background hover:bg-muted text-foreground transition-colors"
        >
          <span>{nodeData.expanded ? "Collapse" : "Expand"}</span>
          {nodeData.expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
});

FilesGroupNode.displayName = "FilesGroupNode";
