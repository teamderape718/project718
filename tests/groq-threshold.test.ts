import { describe, expect, it } from "vitest";
import { passesGroqThreshold } from "../src/ai/groq-quick-score.js";

describe("passesGroqThreshold", () => {
  it("allows when Groq was skipped", () => {
    expect(passesGroqThreshold(null, 40)).toBe(true);
  });

  it("enforces min score when present", () => {
    expect(passesGroqThreshold({ score: 41, note: "" }, 40)).toBe(true);
    expect(passesGroqThreshold({ score: 39, note: "" }, 40)).toBe(false);
  });
});
