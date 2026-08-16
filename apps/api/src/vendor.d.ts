declare module "cookie-parser" {
  import type { RequestHandler } from "express";
  export default function cookieParser(secret?: string | string[]): RequestHandler;
}
declare module "cors" {
  import type { RequestHandler } from "express";
  export default function cors(options?: Record<string, unknown>): RequestHandler;
}
declare module "jsonwebtoken" {
  export interface JwtPayload { sub?: string; [key: string]: unknown }
  export function sign(payload: object, secret: string, options?: object): string;
  export function verify(token: string, secret: string, options?: object): string | JwtPayload;
  const jwt: { sign: typeof sign; verify: typeof verify };
  export default jwt;
}
