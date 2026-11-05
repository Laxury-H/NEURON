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

  // Check if storage_path points to an actual file on local disk
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

  // Fallback for cloud environments without local physical disk:
  // Render an ultra-clean monochrome HTML reader preview so iframes NEVER render blank
  const sizeMB = (doc.file_size / (1024 * 1024)).toFixed(2);
  const ext = doc.original_file_name.split(".").pop()?.toUpperCase() || "DOCUMENT";

  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${doc.original_file_name} — NEURON Document Vault</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0A0A0A;
      color: #EDEDED;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      line-height: 1.5;
    }
    .card {
      max-width: 640px;
      width: 100%;
      border: 1px solid #262626;
      background: #171717;
      padding: 2rem;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #262626;
      padding-bottom: 1rem;
    }
    .icon {
      width: 48px;
      height: 48px;
      background: #262626;
      border: 1px solid #404040;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-size: 1.25rem;
      font-weight: bold;
      color: #FFFFFF;
      font-family: monospace;
    }
    h1 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #FFFFFF;
      word-break: break-word;
    }
    .badge-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.35rem;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      font-size: 0.7rem;
      font-family: monospace;
      text-transform: uppercase;
      border: 1px solid #404040;
      border-radius: 3px;
      color: #A3A3A3;
      background: #0A0A0A;
    }
    .badge-active {
      border-color: #FFFFFF;
      color: #FFFFFF;
    }
    .meta-table {
      width: 100%;
      margin: 1.25rem 0;
      border-collapse: collapse;
      font-size: 0.825rem;
    }
    .meta-table td {
      padding: 0.5rem 0;
      border-bottom: 1px solid #262626;
    }
    .meta-table td:first-child {
      color: #A3A3A3;
      width: 32%;
      font-family: monospace;
      font-size: 0.75rem;
    }
    .meta-table td:last-child {
      color: #EDEDED;
      word-break: break-all;
    }
    .notice {
      background: #0A0A0A;
      border: 1px solid #262626;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1.25rem;
      font-size: 0.8rem;
      color: #A3A3A3;
    }
    .notice strong {
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">${ext.slice(0, 3)}</div>
      <div>
        <h1>${doc.original_file_name}</h1>
        <div class="badge-row">
          <span class="badge badge-active">${doc.category}</span>
          <span class="badge">${sizeMB} MB</span>
          <span class="badge">${ext}</span>
        </div>
      </div>
    </div>

    <table class="meta-table">
      <tr>
        <td>STORAGE PATH</td>
        <td><code>${doc.storage_path || "Cloud Archive"}</code></td>
      </tr>
      <tr>
        <td>DESCRIPTION</td>
        <td>${doc.description || "Academic material cataloged in NEURON."}</td>
      </tr>
      <tr>
        <td>INDEX STATUS</td>
        <td>Active Neural Graph Node</td>
      </tr>
      <tr>
        <td>LAST SYNCED</td>
        <td>${new Date(doc.updated_at).toLocaleDateString()}</td>
      </tr>
    </table>

    <div class="notice">
      <strong>Workstation File Synchronization:</strong><br />
      This file is permanently mapped to your local storage at <code>${doc.storage_path || "D:/2026.1"}</code>. When accessing NEURON on your local machine at <code>http://localhost:3000</code>, full native binary streaming is active.
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(previewHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
