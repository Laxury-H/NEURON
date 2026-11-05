import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseNodeData {
  courseCode: string;
  courseName: string;
  credits: number;
  lecturer?: string | null;
  isSelected?: boolean;
}

export const CourseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as CourseNodeData;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-5 rounded-full text-center transition-all cursor-pointer shadow-md select-none",
        "w-48 h-48 border-2",
        selected
          ? "border-neutral-900 ring-2 ring-neutral-900 ring-offset-2 dark:border-white dark:ring-white"
          : "border-neutral-800 dark:border-neutral-200",
        "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
      )}
    >
      {/* 4 Cardinal Handles with dual source/target semantics mirroring ConceptNode */}
      <Handle
        type="source"
        id="course-top"
        position={Position.Top}
        className="opacity-0 w-2 h-2"
      />
      <Handle
        type="target"
        id="course-top-target"
        position={Position.Top}
        className="opacity-0 w-2 h-2 pointer-events-none"
      />

      <Handle
        type="target"
        id="course-bottom"
        position={Position.Bottom}
        className="opacity-0 w-2 h-2"
      />
      <Handle
        type="source"
        id="course-bottom-source"
        position={Position.Bottom}
        className="opacity-0 w-2 h-2 pointer-events-none"
      />

      <Handle
        type="target"
        id="course-left"
        position={Position.Left}
        className="opacity-0 w-2 h-2"
      />
      <Handle
        type="source"
        id="course-left-source"
        position={Position.Left}
        className="opacity-0 w-2 h-2 pointer-events-none"
      />

      <Handle
        type="source"
        id="course-right"
        position={Position.Right}
        className="opacity-0 w-2 h-2"
      />
      <Handle
        type="target"
        id="course-right-target"
        position={Position.Right}
        className="opacity-0 w-2 h-2 pointer-events-none"
      />

      <div className="flex flex-col items-center max-w-[150px]">
        <div className="mb-1 p-1 rounded-full bg-white/10 dark:bg-black/10">
          <BookOpen className="h-4 w-4" />
        </div>
        <span className="font-mono text-base font-bold tracking-tight">
          {nodeData.courseCode}
        </span>
        <span className="text-xs font-medium leading-tight mt-1 line-clamp-2 opacity-90">
          {nodeData.courseName}
        </span>
        <span className="font-mono text-[10px] opacity-75 mt-1.5 uppercase tracking-wider">
          {nodeData.credits} Credits
        </span>
      </div>
    </div>
  );
});

CourseNode.displayName = "CourseNode";
