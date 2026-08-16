import "dotenv/config";
import { z } from "zod";

const nodeEnvironment = process.env.NODE_ENV || "development";
const localJwtSecret = "storyboard-local-development-secret-2026";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.preprocess(value => value === "" ? undefined : value, z.string().min(1).optional()),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().default("http://localhost:3000,http://localhost:3100").refine(
    value => value.split(",").every(origin => z.string().url().safeParse(origin.trim()).success),
    "FRONTEND_URL must contain one or more comma-separated URLs"
  ),
  COOKIE_DOMAIN: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().url().optional().or(z.literal("")),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().min(60).max(3600).default(900),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("StoryBoard <noreply@example.com>"),
  LOCAL_STORAGE_PATH: z.string().default(".data/storage")
});

export const env = schema.parse({
  ...process.env,
  NODE_ENV: nodeEnvironment,
  JWT_SECRET: process.env.JWT_SECRET || (nodeEnvironment === "production" ? undefined : localJwtSecret)
});

if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

export const databaseMode = env.DATABASE_URL?.startsWith("postgresql:") || env.DATABASE_URL?.startsWith("postgres:") ? "postgresql" : "sqlite";
export const remoteStorageConfigured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
export const localStorageEnabled = env.NODE_ENV !== "production" && !remoteStorageConfigured;
export const storageConfigured = remoteStorageConfigured || localStorageEnabled;
