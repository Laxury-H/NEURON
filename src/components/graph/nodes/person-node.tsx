import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PersonNodeData {
  id: string;
  fullName: string;
  nickname?: string | null;
  relationshipType: string;
  major?: string | null;
}

export const PersonNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as PersonNodeData;

  const initials = nodeData.fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative flex items-center space-x-2.5 p-2 rounded-md transition-all cursor-pointer select-none",
        "w-48 border bg-card text-card-foreground shadow-sm",
        selected
          ? "border-neutral-900 ring-2 ring-neutral-900 bg-neutral-100 dark:border-white dark:ring-white dark:bg-neutral-800"
          : "border-border hover:border-neutral-500"
      )}
    >
      <Handle
        type="target"
        position={Position.Right}
        className="opacity-0"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="opacity-0"
      />

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-mono text-[10px] font-bold">
        {initials}
      </div>

      <div className="flex flex-col truncate">
        <span className="text-xs font-semibold text-foreground truncate">
          {nodeData.fullName}
        </span>
        <div className="flex items-center space-x-1 mt-0.5">
          <Badge variant="subtle" className="text-[9px] px-1 py-0 h-4 uppercase font-mono">
            {nodeData.relationshipType}
          </Badge>
        </div>
      </div>
    </div>
  );
});

PersonNode.displayName = "PersonNode";
