import { z } from "zod";
import { isSmsTemplateKey, type SmsTemplateKey } from "../../services/sms-templates.js";

export const NEGOTIATION_STAGES = [
  "new",
  "contacted",
  "negotiating",
  "won",
  "lost",
] as const;

export type NegotiationStage = (typeof NEGOTIATION_STAGES)[number];

export function isNegotiationStage(s: string): s is NegotiationStage {
  return (NEGOTIATION_STAGES as readonly string[]).includes(s);
}

const stageSchema = z.enum(NEGOTIATION_STAGES);

const smsTemplateSchema = z
  .string()
  .refine((k): k is SmsTemplateKey => isSmsTemplateKey(k), "invalid template");

export const whitelistedActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_stage"),
    negotiation_id: z.number().int().positive(),
    stage: stageSchema,
  }),
  z.object({
    type: z.literal("append_note"),
    negotiation_id: z.number().int().positive(),
    text: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("send_sms"),
    negotiation_id: z.number().int().positive(),
    template: smsTemplateSchema,
    model_label: z.string().max(500).optional(),
    slots_text: z.string().max(2000).optional(),
    when_where: z.string().max(2000).optional(),
  }),
]);

export type WhitelistedAction = z.infer<typeof whitelistedActionSchema>;

export const whitelistedPlanSchema = z.object({
  actions: z.array(whitelistedActionSchema).max(8),
  reply_hint: z.string().max(2000).optional(),
});

export type WhitelistedPlan = z.infer<typeof whitelistedPlanSchema>;

export function parseWhitelistedPlanJson(raw: unknown): WhitelistedPlan | null {
  const parsed = whitelistedPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
