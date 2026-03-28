import { describe, expect, it } from "vitest";
import { tryParseRegexPlan } from "../src/telegram/nlu/intent-router.js";
import { parseWhitelistedPlanJson } from "../src/telegram/nlu/types.js";

describe("tryParseRegexPlan", () => {
  it("parses stage shortcuts", () => {
    expect(tryParseRegexPlan("deal 12 contacted")).toEqual({
      actions: [{ type: "set_stage", negotiation_id: 12, stage: "contacted" }],
    });
    expect(tryParseRegexPlan("négociation #5 lost")).toEqual({
      actions: [{ type: "set_stage", negotiation_id: 5, stage: "lost" }],
    });
    expect(tryParseRegexPlan("nego 1 stage new")).toEqual({
      actions: [{ type: "set_stage", negotiation_id: 1, stage: "new" }],
    });
  });

  it("parses notes", () => {
    expect(tryParseRegexPlan("note 7 Rappeler à 14h")).toEqual({
      actions: [{ type: "append_note", negotiation_id: 7, text: "Rappeler à 14h" }],
    });
  });

  it("parses sms templates", () => {
    expect(tryParseRegexPlan("sms 3 contact")).toEqual({
      actions: [{ type: "send_sms", negotiation_id: 3, template: "contact" }],
    });
    expect(tryParseRegexPlan("envoyer sms 9 slots Lun 10h, Mar 15h")).toEqual({
      actions: [
        {
          type: "send_sms",
          negotiation_id: 9,
          template: "slots",
          slots_text: "Lun 10h, Mar 15h",
        },
      ],
    });
    expect(tryParseRegexPlan("sms 4 confirm_rdv demain 14h, garage")).toEqual({
      actions: [
        {
          type: "send_sms",
          negotiation_id: 4,
          template: "confirm_rdv",
          when_where: "demain 14h, garage",
        },
      ],
    });
  });

  it("returns null for unrelated text", () => {
    expect(tryParseRegexPlan("bonjour")).toBeNull();
    expect(tryParseRegexPlan("deal abc contacted")).toBeNull();
  });
});

describe("parseWhitelistedPlanJson", () => {
  it("accepts valid LLM-shaped payloads", () => {
    const p = parseWhitelistedPlanJson({
      actions: [
        { type: "set_stage", negotiation_id: 2, stage: "won" },
        { type: "append_note", negotiation_id: 2, text: "OK" },
      ],
      reply_hint: "Fait.",
    });
    expect(p?.actions).toHaveLength(2);
    expect(p?.reply_hint).toBe("Fait.");
  });

  it("rejects invalid stages or templates", () => {
    expect(
      parseWhitelistedPlanJson({
        actions: [{ type: "set_stage", negotiation_id: 1, stage: "bogus" }],
      })
    ).toBeNull();
    expect(
      parseWhitelistedPlanJson({
        actions: [{ type: "send_sms", negotiation_id: 1, template: "hack" }],
      })
    ).toBeNull();
  });
});
