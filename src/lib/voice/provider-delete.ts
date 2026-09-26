import "server-only";

const PROVIDER_ID = /^[A-Za-z0-9_-]{5,200}$/;

export async function deleteAssemblySession(providerSessionId: string) {
  if (!PROVIDER_ID.test(providerSessionId)) return "skipped" as const;
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return "pending" as const;
  try {
    const deletion = await fetch(`https://agents.assemblyai.com/v1/sessions/${encodeURIComponent(providerSessionId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (deletion.ok || deletion.status === 404) return "deleted" as const;
    return "pending" as const;
  } catch {
    return "pending" as const;
  }
}
