import type { PoolClient } from "pg";
import * as repo from "../../portal/repo.js";
import { buildSmsFromTemplate, validateSmsTemplatePayload } from "../../services/sms-templates.js";
import { smsWithTemplate } from "../../services/telnyx-sms.js";
import { normalizeToE164 } from "../../utils/phone.js";
import type { WhitelistedAction, WhitelistedPlan } from "./types.js";

export type ExecuteMeta = {
  actor: string;
  source: "regex" | "llm";
};

export type ExecuteResult = {
  lines: string[];
  ok: boolean;
};

export async function executeWhitelistedPlan(
  client: PoolClient,
  plan: WhitelistedPlan,
  meta: ExecuteMeta
): Promise<ExecuteResult> {
  const lines: string[] = [];
  let ok = true;

  for (const action of plan.actions) {
    try {
      const line = await executeOneAction(client, action, meta);
      lines.push(line);
      if (line.startsWith("Erreur")) ok = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lines.push(`Erreur : ${msg}`);
      ok = false;
    }
  }

  return { lines, ok };
}

async function executeOneAction(
  client: PoolClient,
  action: WhitelistedAction,
  meta: ExecuteMeta
): Promise<string> {
  const baseDetail = { negotiation_id: action.negotiation_id, source: meta.source };

  switch (action.type) {
    case "set_stage": {
      const row = await repo.getNegotiation(client, action.negotiation_id);
      if (!row) {
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.set_stage.failed",
          detail: { ...baseDetail, reason: "not_found" },
        });
        return `Erreur : négociation #${action.negotiation_id} introuvable.`;
      }
      const from = row.stage;
      await repo.updateNegotiation(client, action.negotiation_id, { stage: action.stage });
      await repo.insertAuditLog(client, {
        actor: meta.actor,
        action: "nlu.set_stage",
        detail: { ...baseDetail, from_stage: from, to_stage: action.stage },
      });
      return `Étape mise à jour : #${action.negotiation_id} ${from} → ${action.stage}.`;
    }
    case "append_note": {
      const row = await repo.getNegotiation(client, action.negotiation_id);
      if (!row) {
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.append_note.failed",
          detail: { ...baseDetail, reason: "not_found" },
        });
        return `Erreur : négociation #${action.negotiation_id} introuvable.`;
      }
      await repo.appendNegotiationNote(client, action.negotiation_id, action.text);
      await repo.insertAuditLog(client, {
        actor: meta.actor,
        action: "nlu.append_note",
        detail: { ...baseDetail, text_preview: action.text.slice(0, 120) },
      });
      return `Note ajoutée sur #${action.negotiation_id}.`;
    }
    case "send_sms": {
      const nego = await repo.getNegotiation(client, action.negotiation_id);
      if (!nego) {
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.send_sms.failed",
          detail: { ...baseDetail, reason: "not_found" },
        });
        return `Erreur : négociation #${action.negotiation_id} introuvable.`;
      }
      const phone = normalizeToE164(nego.seller_phone ?? "");
      if (!phone) {
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.send_sms.failed",
          detail: { ...baseDetail, reason: "no_phone" },
        });
        return `Erreur : pas de numéro vendeur valide pour #${action.negotiation_id}.`;
      }
      const modelLabel = action.model_label ?? nego.title ?? undefined;
      const vPre = validateSmsTemplatePayload(action.template, {
        slotsText: action.slots_text,
        whenWhere: action.when_where,
      });
      if (!vPre.ok) {
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.send_sms.failed",
          detail: { ...baseDetail, reason: "validation", error: vPre.error.slice(0, 300) },
        });
        return `Erreur : ${vPre.error}`;
      }
      let res;
      try {
        res = await smsWithTemplate({
          toE164: phone,
          template: action.template,
          modelLabel,
          slotsText: action.slots_text,
          whenWhere: action.when_where,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await repo.insertAuditLog(client, {
          actor: meta.actor,
          action: "nlu.send_sms.failed",
          detail: { ...baseDetail, reason: "telnyx", error: msg.slice(0, 300) },
        });
        return `Erreur Telnyx : ${msg}`;
      }
      const bodyText = buildSmsFromTemplate(action.template, {
        modelLabel,
        slotsText: action.slots_text,
        whenWhere: action.when_where,
      });
      await repo.insertNegotiationMessage(client, {
        negotiation_id: action.negotiation_id,
        direction: "out",
        body: bodyText,
        provider_id: res.data?.id ?? null,
        template_key: action.template,
      });
      await repo.updateNegotiation(client, action.negotiation_id, {});
      await repo.insertAuditLog(client, {
        actor: meta.actor,
        action: "nlu.send_sms",
        detail: {
          ...baseDetail,
          template: action.template,
          provider_id: res.data?.id ?? null,
        },
      });
      return `SMS envoyé (#${action.negotiation_id}, ${action.template}).`;
    }
    default: {
      return "Erreur : action non reconnue.";
    }
  }
}
