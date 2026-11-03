import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { FileText, FileSpreadsheet, Presentation, FileCode, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DocumentNodeData {
  id: string;
  originalFileName: string;
  category: string;
  mimeType: string;
  fileSize: number;
}

export const DocumentNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DocumentNodeData;

  const getFileIcon = (mime: string, name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf" || mime.includes("pdf")) return <FileText className="h-3.5 w-3.5" />;
    if (ext === "ppt" || ext === "pptx") return <Presentation className="h-3.5 w-3.5" />;
    if (ext === "xls" || ext === "xlsx" || ext === "csv") return <FileSpreadsheet className="h-3.5 w-3.5" />;
    if (ext === "ts" || ext === "js" || ext === "py" || ext === "m") return <FileCode className="h-3.5 w-3.5" />;
    return <File className="h-3.5 w-3.5" />;
  };

  const ext = nodeData.originalFileName.split(".").pop()?.toUpperCase() || "FILE";

  return (
    <div
      className={cn(
        "relative flex items-center space-x-2.5 p-2 rounded-md transition-all cursor-pointer select-none",
        "w-52 border bg-card text-card-foreground shadow-sm",
        selected
          ? "border-neutral-900 ring-2 ring-neutral-900 bg-neutral-100 dark:border-white dark:ring-white dark:bg-neutral-800"
          : "border-border hover:border-neutral-500"
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

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground border border-border">
        {getFileIcon(nodeData.mimeType, nodeData.originalFileName)}
      </div>

      <div className="flex flex-col truncate">
        <span
          className="text-xs font-semibold text-foreground truncate"
          title={nodeData.originalFileName}
        >
          {nodeData.originalFileName}
        </span>
        <div className="flex items-center space-x-1.5 mt-0.5">
          <Badge variant="subtle" className="text-[9px] px-1 py-0 h-4 uppercase font-mono">
            {nodeData.category}
          </Badge>
          <span className="text-[9px] font-mono text-muted-foreground">
            {ext}
          </span>
        </div>
      </div>
    </div>
  );
});

DocumentNode.displayName = "DocumentNode";
