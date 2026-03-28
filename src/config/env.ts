import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-20241022"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  GROQ_MIN_SCORE: z.coerce.number().min(0).max(100).default(40),
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_FROM_NUMBER: z.string().optional(),
  TELNYX_MESSAGING_PROFILE_ID: z.string().optional(),
  NOTIFY_SMS_TO: z.string().optional(),
  KIJIJI_QUEBEC_AUTOS_URL: z
    .string()
    .url()
    .default("https://www.kijiji.ca/b-autos-camions/quebec/c174l9001"),
  /** Bot Telegram (npm run bot) */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  /** Liste d’IDs de chat autorisés, séparés par des virgules (vide = tout le monde) */
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
  TELEGRAM_SCAN_PAGES: z.coerce.number().min(1).max(20).default(2),
  TELEGRAM_DEALS_MAX: z.coerce.number().min(1).max(15).default(5),
  /** Marge min. (%) sous médiane pour « fort potentiel » si pas encore HOT (15%) */
  TELEGRAM_MIN_MARGIN_PCT: z.coerce.number().min(0).max(30).default(10),
  /** Site + admin (JWT). Changez en production. */
  JWT_SECRET: z.string().min(16).default("dev-only-change-me-32chars!"),
  /** Création du 1er admin : npm run seed:admin */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  /** URL publique du site (lien dans Telegram), ex. https://tondomaine.com */
  PUBLIC_SITE_URL: z.string().url().optional(),
  HEADLESS: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return true;
    const s = String(val).toLowerCase();
    return s !== "0" && s !== "false";
  }, z.boolean()),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
