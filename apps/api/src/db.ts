import { PrismaClient } from "@prisma/client";
import { PrismaClient as LocalPrismaClient } from "../generated/local/index.js";
import { databaseMode } from "./env.js";

const log = process.env.NODE_ENV === "development" ? ["warn", "error"] as const : ["error"] as const;
export const db: any = databaseMode === "postgresql"
  ? new PrismaClient({ log: [...log] })
  : new LocalPrismaClient({ log: [...log] });

export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item));
}
