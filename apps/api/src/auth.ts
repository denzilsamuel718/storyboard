import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { env } from "./env.js";

export type SessionUser = { id: string; role: "CREATOR" | "ADMIN"; email: string; name: string };
declare global { namespace Express { interface Request { user?: SessionUser; requestId: string } } }

export const cookieName = "storyboard_session";
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  domain: env.COOKIE_DOMAIN || undefined,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export function createSession(user: SessionUser) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "7d", issuer: "storyboard-api" });
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
    const token = req.cookies?.[cookieName] || bearer;
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "storyboard-api" }) as { sub?: string };
    const user = await db.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, role: true, email: true, name: true, active: true } });
    if (!user?.active) return res.status(401).json({ error: "Authentication required" });
    req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
    next();
  } catch { return res.status(401).json({ error: "Authentication required" }); }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Administrator access required" });
  next();
}
