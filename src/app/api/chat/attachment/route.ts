import { NextRequest, NextResponse } from "next/server";
import { generateAttachmentAnswer } from "@/lib/ai/gemini";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";

function validSignature(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/webp") return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const guest = !user || user.isDemo;
  const key = guest ? `attachment:guest:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "local"}` : `attachment:${user.userId}`;
  if (!checkRateLimit(key, guest ? 5 : 20, guest ? 86_400_000 : 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const message = form?.get("message");
  if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024 || typeof message !== "string" || message.trim().length > 4000) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(file.type, bytes)) return NextResponse.json({ error: "UNSUPPORTED_FILE" }, { status: 400 });

  const prompt = `You are Inko, a careful study and research assistant. Explain the attached ${file.type === "application/pdf" ? "PDF" : "image"} using only what you can actually read from it. Answer the user's question. Quote or cite a page only if it is visible and identifiable. Say when a detail is unclear; never invent citations. Keep the response clear and useful.\n\nFile: ${file.name.slice(0, 160)}\nQuestion: ${message.trim() || "Explain this file and its key points."}`;
  try {
    const text = await generateAttachmentAnswer(prompt, file.type, Buffer.from(bytes).toString("base64"));
    return NextResponse.json({ text });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "GEMINI_FAILED";
    return NextResponse.json({ error: code === "GEMINI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "ANALYSIS_FAILED" }, { status: code === "GEMINI_NOT_CONFIGURED" ? 503 : 502 });
  }
}
