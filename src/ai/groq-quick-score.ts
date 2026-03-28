import { loadEnv } from "../config/env.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqLeadScore = {
  score: number;
  note: string;
};

/**
 * Fast lead scoring via Groq (Llama). Returns null if GROQ_API_KEY unset.
 */
export async function quickScoreWithGroq(params: {
  title: string;
  description: string;
  priceCad: number | null;
  year: number | null;
}): Promise<GroqLeadScore | null> {
  const env = loadEnv();
  if (!env.GROQ_API_KEY) return null;

  const user = `Rate this private car listing for flip potential in Quebec (0=skip, 100=strong).
Consider price realism vs age/mileage hints in text. JSON only:
{"score": number 0-100, "note": "short"}

Title: ${params.title}
Year: ${params.year ?? "unknown"}
Price CAD: ${params.priceCad ?? "unknown"}
Description:
${params.description.slice(0, 8000)}`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 200,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { score: 50, note: "unparseable" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      score?: number;
      note?: string;
    };
    const score = Math.min(
      100,
      Math.max(0, Number(parsed.score))
    );
    return {
      score: Number.isFinite(score) ? score : 50,
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return { score: 50, note: "invalid json" };
  }
}

export function passesGroqThreshold(
  score: GroqLeadScore | null,
  minScore: number
): boolean {
  if (score == null) return true;
  return score.score >= minScore;
}
