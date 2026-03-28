import { loadEnv } from "../config/env.js";

export type TelegramNotifyInlineKeyboard = { text: string; url: string }[][];

/**
 * Envoie un message HTML aux chats listés dans TELEGRAM_ALLOWED_CHAT_IDS.
 * Sans token ou sans IDs configurés, ne fait rien (pas de broadcast anonyme).
 */
export async function notifyTelegramHtml(
  html: string,
  options?: { inline_keyboard?: TelegramNotifyInlineKeyboard }
): Promise<void> {
  const env = loadEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const ids =
    env.TELEGRAM_ALLOWED_CHAT_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (!ids.length) return;

  const kb = options?.inline_keyboard?.filter((row) => row.length > 0);
  const reply_markup =
    kb && kb.length > 0 ? { inline_keyboard: kb } : undefined;

  for (const chatId of ids) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(reply_markup ? { reply_markup } : {}),
        }),
      });
    } catch {
      /* ignore single chat failures */
    }
  }
}
