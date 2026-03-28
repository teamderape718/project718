import { loadEnv } from "../config/env.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type ClaudeListingAnalysis = {
  majorMechanicalOrPerforation: boolean;
  brief: string;
};

/**
 * Deep NLP pass: mechanical / perforation risk from listing text.
 * Skips (returns null) when ANTHROPIC_API_KEY is unset.
 */
export async function analyzeListingWithClaude(
  description: string
): Promise<ClaudeListingAnalysis | null> {
  const env = loadEnv();
  if (!env.ANTHROPIC_API_KEY) return null;

  const prompt = `You are assisting a Quebec used-car buyer. Read the listing text (French or English).

Question: Does this vehicle likely have major mechanical problems OR body perforations / structural rust (not surface rust only)?

Reply with JSON only, no markdown:
{"majorMechanicalOrPerforation": true or false, "brief": "one short sentence"}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n---\nLISTING:\n${description.slice(0, 24_000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { majorMechanicalOrPerforation: false, brief: "unparseable response" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      majorMechanicalOrPerforation?: boolean;
      brief?: string;
    };
    return {
      majorMechanicalOrPerforation: Boolean(parsed.majorMechanicalOrPerforation),
      brief: typeof parsed.brief === "string" ? parsed.brief : "",
    };
  } catch {
    return { majorMechanicalOrPerforation: false, brief: "invalid json" };
  }
}
