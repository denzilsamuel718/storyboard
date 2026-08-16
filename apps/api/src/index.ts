import "dotenv/config";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { Prisma, SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { ALLOWED_FILES, SUBMISSION_STATUSES, SUBMISSION_TYPES } from "@storyboard/shared";
import { databaseMode, env, localStorageEnabled, storageConfigured } from "./env.js";
import { db, jsonSafe } from "./db.js";
import { formatSubmissionId } from "./submission-id.js";
import { notifications } from "./notifications.js";
import { authenticate, cookieName, cookieOptions, createSession, requireAdmin } from "./auth.js";
import { abortMultipart, completeMultipart, getLocalDownload, initiateMultipart, makeStorageKey, signDownload, signPart, storeLocalPart } from "./storage.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
const allowedOrigins = env.FRONTEND_URL.split(",").map(value => value.trim().replace(/\/$/, ""));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], exposedHeaders: ["ETag"] }));
app.put("/api/local-storage/upload-part", express.raw({ type: "*/*", limit: "12mb" }), async (req, res) => {
  if (!localStorageEnabled) return res.status(404).json({ error: "Not found" });
  try {
    const etag = await storeLocalPart(String(req.query.token || ""), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    res.setHeader("ETag", etag).status(200).end();
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});
app.get("/api/local-storage/download", async (req, res) => {
  if (!localStorageEnabled) return res.status(404).json({ error: "Not found" });
  try {
    const file = await getLocalDownload(String(req.query.token || ""));
    res.download(file.location, file.filename);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "File not found" });
  }
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.cookies?.[cookieName]) {
    const origin = req.get("origin")?.replace(/\/$/, "");
    if (!origin || !allowedOrigins.includes(origin)) return res.status(403).json({ error: "Request origin is not allowed" });
  }
  next();
});
app.use((req, res, next) => { req.requestId = String(req.headers["x-request-id"] || crypto.randomUUID()); res.setHeader("x-request-id", req.requestId); next(); });

const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const uploadLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("hex");
const cleanName = (name: string) => name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 180);
const routeId = (req: Request) => String(req.params.id);
const containsText = (value: string) => databaseMode === "sqlite" ? { contains: value } : { contains: value, mode: "insensitive" as const };

async function audit(req: Request, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) {
  await db.auditLog.create({ data: { actorId: req.user?.id, action, entity, entityId, requestId: req.requestId, ip: req.ip, before: before as Prisma.InputJsonValue | undefined, after: after as Prisma.InputJsonValue | undefined } });
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "storyboard-api", timestamp: new Date().toISOString() }));
app.get("/ready", async (_req, res) => { try { await db.$queryRaw`SELECT 1`; res.json({ status: "ready", database: true, storage: storageConfigured }); } catch { res.status(503).json({ status: "not_ready" }); } });

const credentialsSchema = z.object({ email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(8).max(128) });
app.post("/api/auth/register", authLimit, async (req, res) => {
  const parsed = credentialsSchema.extend({ name: z.string().min(2).max(80), phone: z.string().max(30).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the registration details", fields: parsed.error.flatten().fieldErrors });
  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return res.status(409).json({ error: "An account with this email already exists" });
  const raw = newToken();
  const { password, ...profile } = parsed.data;
  const user = await db.user.create({ data: { ...profile, passwordHash: await bcrypt.hash(password, 12), profile: { create: {} }, verificationTokens: { create: { tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } } }, select: { id: true, role: true, email: true, name: true } });
  void notifications.verify(user.email, raw).catch(error => console.error(JSON.stringify({ level: "error", message: "Verification email failed", error: error.message })));
  res.cookie(cookieName, createSession(user), cookieOptions);
  res.status(201).json({ user, message: "Account created", ...(env.NODE_ENV === "development" ? { verificationToken: raw } : {}) });
});

app.post("/api/auth/login", authLimit, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(401).json({ error: "Invalid email or password" });
  let user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user && env.NODE_ENV === "development" && parsed.data.email !== "admin@sb.com") {
    const name = parsed.data.email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Creator";
    user = await db.user.create({
      data: {
        name: name.slice(0, 80),
        email: parsed.data.email,
        emailVerified: true,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        profile: { create: {} }
      }
    });
  }
  if (!user?.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password" });
  const publicUser = { id: user.id, role: user.role, email: user.email, name: user.name };
  res.cookie(cookieName, createSession(publicUser), cookieOptions).json({ user: publicUser });
});
app.post("/api/auth/logout", (_req, res) => res.clearCookie(cookieName, cookieOptions).status(204).end());
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));
app.post("/api/auth/verify-email", authLimit, async (req, res) => {
  const token = z.object({ token: z.string().min(32) }).parse(req.body).token;
  const record = await db.emailVerification.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return res.status(400).json({ error: "Verification link is invalid or expired" });
  await db.$transaction([db.user.update({ where: { id: record.userId }, data: { emailVerified: true } }), db.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
  res.json({ message: "Email verified" });
});
app.post("/api/auth/forgot-password", authLimit, async (req, res) => {
  const email = z.object({ email: z.string().email().transform(v => v.toLowerCase()) }).parse(req.body).email;
  const user = await db.user.findUnique({ where: { email } });
  let raw: string | undefined;
  if (user) { raw = newToken(); await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60 * 60_000) } }); void notifications.reset(user.email, raw).catch(error => console.error(JSON.stringify({ level: "error", message: "Reset email failed", error: error.message }))); }
  res.json({ message: "If the account exists, a reset link has been sent", ...(env.NODE_ENV === "development" && raw ? { resetToken: raw } : {}) });
});
app.post("/api/auth/reset-password", authLimit, async (req, res) => {
  const data = z.object({ token: z.string().min(32), password: z.string().min(8).max(128) }).parse(req.body);
  const record = await db.passwordReset.findUnique({ where: { tokenHash: sha256(data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return res.status(400).json({ error: "Reset link is invalid or expired" });
  await db.$transaction([db.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(data.password, 12) } }), db.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } })]);
  res.json({ message: "Password updated" });
});

const submissionSchema = z.object({
  title: z.string().trim().min(1, "Project title is required").max(160, "Project title is too long"), submissionType: z.enum(SUBMISSION_TYPES), genre: z.string().trim().min(1, "Genre is required").max(80, "Genre is too long"), language: z.string().trim().min(1, "Language is required").max(80, "Language is too long"),
  logline: z.string().trim().min(1, "Logline is required").max(500, "Logline cannot exceed 500 characters"), synopsis: z.string().trim().min(1, "Synopsis is required").max(10_000, "Synopsis is too long"), castCrew: z.string().max(3000, "Character list is too long").optional().nullable(), estimatedDuration: z.coerce.number().int().min(1).max(1000).optional().nullable(), additionalNotes: z.string().max(5000, "Additional notes are too long").optional().nullable(), rightsConfirmed: z.boolean().default(false)
});

app.get("/api/creator/dashboard", authenticate, async (req, res) => {
  if (req.user!.role !== "CREATOR") return res.status(403).json({ error: "Creator access required" });
  const [counts, recent, profile] = await Promise.all([
    db.submission.groupBy({ by: ["status"], where: { creatorId: req.user!.id }, _count: true }),
    db.submission.findMany({ where: { creatorId: req.user!.id }, take: 4, orderBy: { updatedAt: "desc" }, include: { files: { select: { id: true } } } }),
    db.user.findUnique({ where: { id: req.user!.id }, select: { name: true, email: true, phone: true, emailVerified: true, profile: true } })
  ]);
  res.json(jsonSafe({ counts, recent, profile }));
});
app.patch("/api/creator/profile", authenticate, async (req, res) => {
  if (req.user!.role !== "CREATOR") return res.status(403).json({ error: "Creator access required" });
  const data = z.object({ name: z.string().min(2).max(80), phone: z.string().max(30).nullable().optional(), bio: z.string().max(1500).nullable().optional(), portfolioUrl: z.string().url().nullable().optional(), socialLinks: z.record(z.string().url()).optional() }).parse(req.body);
  const { bio, portfolioUrl, socialLinks, ...userData } = data;
  const user = await db.user.update({ where: { id: req.user!.id }, data: { ...userData, profile: { upsert: { create: { bio, portfolioUrl, socialLinks }, update: { bio, portfolioUrl, socialLinks } } } }, select: { name: true, email: true, phone: true, emailVerified: true, profile: true } });
  await audit(req, "CREATOR_PROFILE_UPDATED", "User", req.user!.id);
  res.json({ profile: user });
});
app.post("/api/creator/change-password", authLimit, authenticate, async (req, res) => {
  const data = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(8).max(128) }).parse(req.body);
  const user = await db.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(data.currentPassword, user.passwordHash))) return res.status(400).json({ error: "Current password is incorrect" });
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(data.newPassword, 12) } });
  await audit(req, "PASSWORD_CHANGED", "User", user.id);
  res.json({ message: "Password updated" });
});
app.get("/api/submissions", authenticate, async (req, res) => {
  const submissions = await db.submission.findMany({ where: req.user!.role === "ADMIN" ? {} : { creatorId: req.user!.id }, orderBy: { updatedAt: "desc" }, include: { files: { select: { id: true, fileCategory: true, uploadStatus: true } } } });
  res.json(jsonSafe({ submissions }));
});
app.post("/api/submissions", authenticate, async (req, res) => {
  if (req.user!.role !== "CREATOR") return res.status(403).json({ error: "Creator access required" });
  const parsed = submissionSchema.safeParse(req.body);
  if (!parsed.success) { const fields = parsed.error.flatten().fieldErrors; const firstMessage = Object.values(fields).flat().find(Boolean); return res.status(400).json({ error: firstMessage || "Please check the submission details", fields }); }
  const submission = await db.submission.create({ data: { ...parsed.data, creatorId: req.user!.id } });
  await audit(req, "SUBMISSION_DRAFT_CREATED", "Submission", submission.id, undefined, { title: submission.title });
  res.status(201).json({ submission: jsonSafe(submission) });
});

async function getSubmission(req: Request, id: string, adminExtras = false) {
  return db.submission.findFirst({ where: { id, ...(req.user!.role === "CREATOR" ? { creatorId: req.user!.id } : {}) }, include: { creator: { select: { id: true, name: true, email: true, phone: true, emailVerified: true, profile: true } }, files: true, statusHistory: { where: req.user!.role === "CREATOR" ? { visible: true } : {}, orderBy: { createdAt: "asc" } }, messages: { orderBy: { createdAt: "asc" } }, ...(adminExtras && req.user!.role === "ADMIN" ? { adminNotes: { include: { admin: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } : {}) } });
}
app.get("/api/submissions/:id", authenticate, async (req, res) => { const item = await getSubmission(req, routeId(req), true); if (!item) return res.status(404).json({ error: "Submission not found" }); res.json({ submission: jsonSafe(item) }); });
app.patch("/api/submissions/:id", authenticate, async (req, res) => {
  const existing = await db.submission.findFirst({ where: { id: routeId(req), creatorId: req.user!.id, status: "DRAFT" } });
  if (!existing) return res.status(404).json({ error: "Editable draft not found" });
  const parsed = submissionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the submission details", fields: parsed.error.flatten().fieldErrors });
  const updated = await db.submission.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ submission: jsonSafe(updated) });
});
app.post("/api/submissions/:id/submit", authenticate, async (req, res) => {
  const existing = await db.submission.findFirst({ where: { id: routeId(req), creatorId: req.user!.id, status: "DRAFT" }, include: { files: true } });
  if (!existing) return res.status(404).json({ error: "Draft not found" });
  if (!existing.rightsConfirmed) return res.status(400).json({ error: "Rights confirmation is required" });
  if (existing.files.some((f: { uploadStatus: string }) => f.uploadStatus !== "COMPLETE")) return res.status(400).json({ error: "Finish or remove incomplete uploads before submitting" });
  const updated = await db.$transaction(async (tx: any) => {
    // The zero-keyed counter is global, so SB IDs remain unique across calendar years.
    const counter = await tx.submissionCounter.upsert({ where: { year: 0 }, create: { year: 0, value: 1 }, update: { value: { increment: 1 } } });
    const publicSubmissionId = formatSubmissionId(counter.value);
    const submission = await tx.submission.update({ where: { id: existing.id }, data: { status: "SUBMITTED", publicSubmissionId, submittedAt: new Date() } });
    await tx.submissionStatusHistory.create({ data: { submissionId: existing.id, fromStatus: "DRAFT", toStatus: "SUBMITTED", changedById: req.user!.id } });
    return submission;
  });
  await audit(req, "SUBMISSION_FINALIZED", "Submission", updated.id, { status: "DRAFT" }, { status: "SUBMITTED", publicSubmissionId: updated.publicSubmissionId });
  res.json({ submission: jsonSafe(updated) });
});

const uploadSchema = z.object({ originalName: z.string().min(1).max(255), mimeType: z.string(), sizeBytes: z.coerce.number().int().positive().max(1024 ** 3) });
app.post("/api/submissions/:id/uploads/initiate", uploadLimit, authenticate, async (req, res) => {
  if (!storageConfigured) return res.status(503).json({ error: "Object storage is not configured" });
  const submission = await db.submission.findFirst({ where: { id: routeId(req), creatorId: req.user!.id, status: "DRAFT" } });
  if (!submission) return res.status(404).json({ error: "Editable draft not found" });
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid file metadata" });
  const policy = ALLOWED_FILES[parsed.data.mimeType];
  if (!policy || parsed.data.sizeBytes > policy.max) return res.status(400).json({ error: "This file type or size is not allowed" });
  const storageKey = makeStorageKey(req.user!.id, submission.id);
  const uploadId = await initiateMultipart(storageKey, parsed.data.mimeType);
  const file = await db.submissionFile.create({ data: { submissionId: submission.id, originalName: cleanName(parsed.data.originalName), storageKey, mimeType: parsed.data.mimeType, sizeBytes: BigInt(parsed.data.sizeBytes), fileCategory: policy.category, uploadStatus: "UPLOADING", uploadId } });
  res.status(201).json({ file: jsonSafe(file), partSize: 10 * 1024 ** 2 });
});
app.post("/api/files/:id/sign-part", uploadLimit, authenticate, async (req, res) => {
  const data = z.object({ partNumber: z.coerce.number().int().min(1).max(10_000) }).parse(req.body);
  const file = await db.submissionFile.findFirst({ where: { id: routeId(req), submission: { creatorId: req.user!.id, status: "DRAFT" }, uploadStatus: "UPLOADING" } });
  if (!file?.uploadId) return res.status(404).json({ error: "Active upload not found" });
  res.json({ url: await signPart(file.storageKey, file.uploadId, data.partNumber, `${req.protocol}://${req.get("host")}`) });
});
app.post("/api/files/:id/complete", authenticate, async (req, res) => {
  const data = z.object({ parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number().int().positive() })).min(1) }).parse(req.body);
  const file = await db.submissionFile.findFirst({ where: { id: routeId(req), submission: { creatorId: req.user!.id, status: "DRAFT" }, uploadStatus: "UPLOADING" } });
  if (!file?.uploadId) return res.status(404).json({ error: "Active upload not found" });
  const result = await completeMultipart(file.storageKey, file.uploadId, data.parts.sort((a, b) => a.PartNumber - b.PartNumber));
  const updated = await db.submissionFile.update({ where: { id: file.id }, data: { uploadStatus: "COMPLETE", checksum: result.ETag, uploadId: null } });
  res.json({ file: jsonSafe(updated) });
});
app.delete("/api/files/:id/upload", authenticate, async (req, res) => {
  const file = await db.submissionFile.findFirst({ where: { id: routeId(req), submission: { creatorId: req.user!.id, status: "DRAFT" } } });
  if (!file) return res.status(404).json({ error: "Upload not found" });
  if (file.uploadId) await abortMultipart(file.storageKey, file.uploadId);
  await db.submissionFile.delete({ where: { id: file.id } });
  res.status(204).end();
});
app.get("/api/files/:id/download", authenticate, async (req, res) => {
  const file = await db.submissionFile.findFirst({ where: { id: routeId(req), uploadStatus: "COMPLETE", ...(req.user!.role === "CREATOR" ? { submission: { creatorId: req.user!.id } } : {}) } });
  if (!file) return res.status(404).json({ error: "File not found" });
  res.json({ url: await signDownload(file.storageKey, file.originalName, `${req.protocol}://${req.get("host")}`), expiresIn: env.SIGNED_URL_TTL_SECONDS });
});

app.use("/api/admin", authenticate, requireAdmin);
app.get("/api/admin/dashboard", async (_req, res) => {
  const [creators, submissions, today, byStatus, recent] = await Promise.all([
    db.user.count({ where: { role: "CREATOR" } }), db.submission.count({ where: { status: { not: "DRAFT" } } }),
    db.submission.count({ where: { submittedAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } } }),
    db.submission.groupBy({ by: ["status"], _count: true }),
    db.submission.findMany({ where: { status: { not: "DRAFT" } }, take: 6, orderBy: { submittedAt: "desc" }, include: { creator: { select: { name: true, email: true } } } })
  ]);
  res.json(jsonSafe({ creators, submissions, today, byStatus, recent }));
});
app.get("/api/admin/submissions", async (req, res) => {
  const q = String(req.query.q || "").trim(); const status = String(req.query.status || ""); const type = String(req.query.type || ""); const page = Math.max(1, Number(req.query.page) || 1); const take = 20;
  const where: Prisma.SubmissionWhereInput = { status: status && SUBMISSION_STATUSES.includes(status as never) ? status as SubmissionStatus : { not: "DRAFT" }, ...(type && SUBMISSION_TYPES.includes(type as never) ? { submissionType: type as never } : {}), ...(q ? { OR: [{ publicSubmissionId: containsText(q) }, { title: containsText(q) }, { creator: { name: containsText(q) } }, { creator: { email: containsText(q) } }] } : {}) };
  const [items, total] = await Promise.all([db.submission.findMany({ where, skip: (page - 1) * take, take, orderBy: { submittedAt: "desc" }, include: { creator: { select: { name: true, email: true } }, _count: { select: { files: true } } } }), db.submission.count({ where })]);
  res.json(jsonSafe({ submissions: items, total, page, pages: Math.ceil(total / take) }));
});
app.patch("/api/admin/submissions/:id/status", async (req, res) => {
  const data = z.object({ status: z.enum(SUBMISSION_STATUSES).refine(v => v !== "DRAFT"), message: z.string().max(2000).optional() }).parse(req.body);
  const before = await db.submission.findUnique({ where: { id: routeId(req) } }); if (!before) return res.status(404).json({ error: "Submission not found" });
  if (before.status === data.status && !data.message?.trim()) return res.json({ submission: jsonSafe(before) });
  const updated = await db.$transaction(async (tx: any) => { const item = await tx.submission.update({ where: { id: before.id }, data: { status: data.status, reviewedAt: new Date(), archivedAt: data.status === "ARCHIVED" ? new Date() : before.archivedAt } }); if (before.status !== data.status) await tx.submissionStatusHistory.create({ data: { submissionId: before.id, fromStatus: before.status, toStatus: data.status, changedById: req.user!.id, visible: true } }); if (data.message?.trim()) await tx.creatorMessage.create({ data: { submissionId: before.id, senderId: req.user!.id, body: data.message.trim() } }); return item; });
  await audit(req, "SUBMISSION_STATUS_CHANGED", "Submission", updated.id, { status: before.status }, { status: updated.status });
  const creator = await db.user.findUnique({ where: { id: before.creatorId }, select: { email: true } });
  if (creator && before.publicSubmissionId) void notifications.status(creator.email, before.publicSubmissionId, updated.status).catch(error => console.error(JSON.stringify({ level: "error", message: "Status email failed", error: error.message })));
  res.json({ submission: jsonSafe(updated) });
});
app.post("/api/admin/submissions/:id/notes", async (req, res) => { const body = z.object({ body: z.string().min(1).max(5000) }).parse(req.body).body; const id = routeId(req); const note = await db.adminNote.create({ data: { submissionId: id, adminId: req.user!.id, body } }); await audit(req, "PRIVATE_NOTE_ADDED", "Submission", id); res.status(201).json({ note }); });
app.post("/api/admin/submissions/:id/messages", async (req, res) => { const body = z.object({ body: z.string().min(1).max(3000) }).parse(req.body).body; const id = routeId(req); const message = await db.creatorMessage.create({ data: { submissionId: id, senderId: req.user!.id, body } }); const submission = await db.submission.findUnique({ where: { id }, select: { publicSubmissionId: true, creator: { select: { email: true } } } }); await audit(req, "CREATOR_MESSAGE_ADDED", "Submission", id); if (submission?.publicSubmissionId) void notifications.message(submission.creator.email, submission.publicSubmissionId).catch(error => console.error(JSON.stringify({ level: "error", message: "Message email failed", error: error.message }))); res.status(201).json({ message }); });
app.get("/api/admin/creators", async (req, res) => { const q = String(req.query.q || ""); const creators = await db.user.findMany({ where: { role: "CREATOR", ...(q ? { OR: [{ name: containsText(q) }, { email: containsText(q) }, { phone: containsText(q) }] } : {}) }, orderBy: { createdAt: "desc" }, include: { profile: true, _count: { select: { submissions: true } } } }); res.json({ creators }); });
app.get("/api/admin/creators/:id", async (req, res) => { const creator = await db.user.findFirst({ where: { id: routeId(req), role: "CREATOR" }, select: { id: true, name: true, email: true, phone: true, active: true, emailVerified: true, createdAt: true, profile: true, submissions: { orderBy: { createdAt: "desc" } } } }); if (!creator) return res.status(404).json({ error: "Creator not found" }); res.json({ creator: jsonSafe(creator) }); });
app.patch("/api/admin/creators/:id/access", async (req, res) => { const active = z.object({ active: z.boolean() }).parse(req.body).active; const updated = await db.user.update({ where: { id: routeId(req) }, data: { active } }); await audit(req, active ? "CREATOR_RESTORED" : "CREATOR_SUSPENDED", "User", updated.id); res.json({ creator: { id: updated.id, active: updated.active } }); });
app.get("/api/admin/files", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const files = await db.submissionFile.findMany({ where: q ? { OR: [{ originalName: containsText(q) }, { submission: { title: containsText(q) } }, { submission: { publicSubmissionId: containsText(q) } }] } : {}, take: 100, orderBy: { createdAt: "desc" }, include: { submission: { select: { id: true, title: true, publicSubmissionId: true, creator: { select: { name: true } } } } } });
  res.json({ files: jsonSafe(files) });
});
app.get("/api/admin/messages", async (_req, res) => {
  const messages = await db.creatorMessage.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { submission: { select: { id: true, title: true, publicSubmissionId: true, creator: { select: { name: true, email: true } } } } } });
  res.json({ messages });
});
app.get("/api/admin/settings", async (_req, res) => {
  res.json({ settings: { storageConfigured, emailConfigured: Boolean(env.RESEND_API_KEY), frontendOrigin: env.FRONTEND_URL, signedUrlTtlSeconds: env.SIGNED_URL_TTL_SECONDS, environment: env.NODE_ENV } });
});
app.get("/api/admin/audit", async (_req, res) => { const logs = await db.auditLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, email: true } } } }); res.json({ logs }); });

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({ level: "error", requestId: req.requestId, path: req.path, message: err instanceof Error ? err.message : "Unknown error" }));
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid request", fields: err.flatten().fieldErrors, requestId: req.requestId });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return res.status(409).json({ error: "This record already exists", requestId: req.requestId });
  res.status(500).json({ error: "Something went wrong", requestId: req.requestId });
});

const server = app.listen(env.PORT, () => console.log(JSON.stringify({ level: "info", message: `API listening on ${env.PORT}` })));
const shutdown = async () => { server.close(); await db.$disconnect(); process.exit(0); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
export { app };
