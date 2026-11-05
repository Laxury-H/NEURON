import { z } from "zod";
import { summarizeDocumentLocally, type AcademicSummary } from "../../../../lib/ai/local-summarizer.ts";

export const runtime = "edge";

const SummarizeRequestSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
  courseId: z.string().min(1, "courseId is required"),
  fileName: z.string().min(1, "fileName is required"),
  rawTextContent: z.string().default(""),
  category: z.string().default("Notes"),
});

const AcademicSummarySchema = z.object({
  documentId: z.string(),
  executiveSummary: z.string().max(500),
  keyTakeaways: z.array(z.string()).min(3).max(5),
  extractedFormulas: z.array(
    z.object({
      name: z.string(),
      latex: z.string(),
      description: z.string(),
    })
  ).default([]),
  candidateConcepts: z.array(z.string()).min(1).max(8),
  generatedAt: z.string(),
});

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = SummarizeRequestSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        {
          error: "Invalid request payload schema",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { documentId, courseId, fileName, rawTextContent, category } = validation.data;

    // Check if external OpenAI-compatible provider is configured
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    if (apiKey) {
      try {
        const systemPrompt = `You are NEURON Academic Intelligence, an expert university-level academic research assistant.
Analyze the following academic text extracted from document "${fileName}" belonging to course "${courseId}".

Output MUST strictly conform to the following JSON schema. Do not output markdown code blocks or conversational text.
{
  "documentId": "${documentId}",
  "executiveSummary": "Concise 2-sentence summary of the academic core under 300 characters.",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "extractedFormulas": [{"name": "Formula Name", "latex": "\\\\frac{a}{b}", "description": "Meaning"}],
  "candidateConcepts": ["Concept A", "Concept B"]
}

Rules:
1. Tone must be strictly academic, objective, rigorous, and concise.
2. In LaTeX formulas, use standard AMS-LaTeX syntax.
3. Candidate concepts must be atomic academic subjects, not generic words.
4. keyTakeaways must contain between 3 and 5 items.
5. candidateConcepts must contain between 1 and 8 items.`;

        const userPrompt = `Document: ${fileName}\nCategory: ${category}\nContent:\n${rawTextContent.slice(0, 12000)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const completion = await response.json();
          const content = completion.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const valid = AcademicSummarySchema.safeParse({
              ...parsed,
              documentId,
              generatedAt: new Date().toISOString(),
            });
            if (valid.success) {
              return Response.json(valid.data);
            }
          }
        }
      } catch {
        // Fallback silently to deterministic local NLP extractor on any network error/timeout
      }
    }

    // Deterministic Local Fallback (offline-safe, instant, zero external dependency)
    const localSummary: AcademicSummary = summarizeDocumentLocally(
      rawTextContent,
      fileName,
      category,
      documentId
    );

    return Response.json(localSummary, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Summarizer-Engine": apiKey ? "openai-with-local-fallback" : "deterministic-local-heuristic",
      },
    });
  } catch {
    // Ultimate defensive handler: guarantees no 500 error
    const fallback = summarizeDocumentLocally("", "Document", "Notes", "doc-summary");
    return Response.json(fallback, { status: 200 });
  }
}
