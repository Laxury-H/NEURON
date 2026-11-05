import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { INITIAL_DOCUMENTS } from "@/lib/data/mock-data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc = INITIAL_DOCUMENTS.find((d) => d.id === id);
  if (!doc) {
    return new NextResponse("Document not found in repository", { status: 404 });
  }

  // Check if storage_path points to an actual file on disk
  if (doc.storage_path && fs.existsSync(doc.storage_path)) {
    try {
      const stat = fs.statSync(doc.storage_path);
      const fileBuffer = fs.readFileSync(doc.storage_path);

      const mime = doc.mime_type || "application/octet-stream";
      const filename = doc.original_file_name || path.basename(doc.storage_path);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Length": stat.size.toString(),
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err) {
      console.error("Error reading document file:", err);
      return new NextResponse("Error reading file from storage", { status: 500 });
    }
  }

  // Fallback placeholder for documents without physical storage file
  const fallbackText = `NEURON Document Vault\n\nFilename: ${doc.original_file_name}\nCategory: ${doc.category}\nDescription: ${doc.description || "Academic material"}\nUploaded: ${doc.uploaded_at}\n\nThis file reference is indexed in your NEURON second-brain workspace.`;
  return new NextResponse(fallbackText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.original_file_name)}.txt"`,
    },
  });
}
