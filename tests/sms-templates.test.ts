import { describe, expect, it } from "vitest";
import {
  buildSmsFromTemplate,
  validateSmsBodyLength,
  validateSmsTemplatePayload,
} from "../src/services/sms-templates.js";

describe("validateSmsTemplatePayload", () => {
  it("allows contact and followup without extra fields", () => {
    expect(validateSmsTemplatePayload("contact", {})).toEqual({ ok: true });
    expect(validateSmsTemplatePayload("followup", {})).toEqual({ ok: true });
  });

  it("requires non-trivial slots_text for slots", () => {
    expect(validateSmsTemplatePayload("slots", {}).ok).toBe(false);
    expect(validateSmsTemplatePayload("slots", { slotsText: "  " }).ok).toBe(false);
    expect(validateSmsTemplatePayload("slots", { slotsText: "ab" }).ok).toBe(false);
    expect(validateSmsTemplatePayload("slots", { slotsText: "Lun 10h" }).ok).toBe(true);
  });

  it("requires non-trivial when_where for confirm_rdv", () => {
    expect(validateSmsTemplatePayload("confirm_rdv", {}).ok).toBe(false);
    expect(validateSmsTemplatePayload("confirm_rdv", { whenWhere: "demain" }).ok).toBe(
      false
    );
    expect(
      validateSmsTemplatePayload("confirm_rdv", { whenWhere: "demain 14h chez vous" }).ok
    ).toBe(true);
  });
});

describe("validateSmsBodyLength", () => {
  it("rejects oversized bodies", () => {
    const long = "x".repeat(1025);
    expect(validateSmsBodyLength(long).ok).toBe(false);
    expect(validateSmsBodyLength("x".repeat(1024)).ok).toBe(true);
  });
});

describe("buildSmsFromTemplate", () => {
  it("includes slots and RDV details when provided", () => {
    expect(
      buildSmsFromTemplate("slots", { modelLabel: "Civic", slotsText: "Mar 15h" })
    ).toContain("Mar 15h");
    expect(
      buildSmsFromTemplate("confirm_rdv", { modelLabel: "Civic", whenWhere: "jeu. 10h" })
    ).toContain("jeu. 10h");
  });
});
