import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectCommand, S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, localStorageEnabled, remoteStorageConfigured } from "./env.js";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(env.S3_ENDPOINT),
  credentials: remoteStorageConfigured ? { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! } : undefined
});

export const makeStorageKey = (userId: string, submissionId: string) => `creators/${userId}/submissions/${submissionId}/${randomUUID()}`;

export async function initiateMultipart(key: string, mimeType: string) {
  if (localStorageEnabled) return randomUUID();
  const result = await s3.send(new CreateMultipartUploadCommand({ Bucket: env.S3_BUCKET!, Key: key, ContentType: mimeType, ServerSideEncryption: "AES256" }));
  if (!result.UploadId) throw new Error("Storage did not return an upload ID");
  return result.UploadId;
}

type LocalStorageToken = {
  action: "upload" | "download";
  key: string;
  uploadId?: string;
  partNumber?: number;
  filename?: string;
  expiresAt: number;
};

const storageRoot = path.resolve(env.LOCAL_STORAGE_PATH);
const tokenSignature = (body: string) => crypto.createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
const makeLocalToken = (payload: Omit<LocalStorageToken, "expiresAt">) => {
  const body = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + env.SIGNED_URL_TTL_SECONDS * 1000 })).toString("base64url");
  return `${body}.${tokenSignature(body)}`;
};
const readLocalToken = (token: string, action: LocalStorageToken["action"]) => {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("Invalid storage link");
  const expected = tokenSignature(body);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid storage link");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LocalStorageToken;
  if (payload.action !== action || payload.expiresAt < Date.now()) throw new Error("Storage link has expired");
  return payload;
};
const partPath = (uploadId: string, partNumber: number) => path.join(storageRoot, "parts", uploadId, String(partNumber));
const filePath = (key: string) => path.join(storageRoot, "files", ...key.split("/"));

export async function signPart(key: string, uploadId: string, partNumber: number, apiBase: string) {
  if (!localStorageEnabled) return getSignedUrl(s3, new UploadPartCommand({ Bucket: env.S3_BUCKET!, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: env.SIGNED_URL_TTL_SECONDS });
  const url = new URL("/api/local-storage/upload-part", apiBase);
  url.searchParams.set("token", makeLocalToken({ action: "upload", key, uploadId, partNumber }));
  return url.toString();
}

export async function storeLocalPart(token: string, data: Buffer) {
  if (!localStorageEnabled) throw new Error("Local storage is disabled");
  const payload = readLocalToken(token, "upload");
  if (!payload.uploadId || !payload.partNumber) throw new Error("Invalid upload link");
  const destination = partPath(payload.uploadId, payload.partNumber);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
  return `\"${crypto.createHash("md5").update(data).digest("hex")}\"`;
}

export async function completeMultipart(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]) {
  if (!localStorageEnabled) return s3.send(new CompleteMultipartUploadCommand({ Bucket: env.S3_BUCKET!, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
  const destination = filePath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.alloc(0));
  const hash = crypto.createHash("sha256");
  for (const part of parts.sort((a, b) => a.PartNumber - b.PartNumber)) {
    const chunk = await readFile(partPath(uploadId, part.PartNumber));
    hash.update(chunk);
    await appendFile(destination, chunk);
  }
  await rm(path.join(storageRoot, "parts", uploadId), { recursive: true, force: true });
  return { ETag: `\"${hash.digest("hex")}\"` };
}

export async function abortMultipart(key: string, uploadId: string) {
  if (!localStorageEnabled) return s3.send(new AbortMultipartUploadCommand({ Bucket: env.S3_BUCKET!, Key: key, UploadId: uploadId }));
  await rm(path.join(storageRoot, "parts", uploadId), { recursive: true, force: true });
  return {};
}

export async function signDownload(key: string, filename: string, apiBase: string) {
  if (!localStorageEnabled) return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }), { expiresIn: env.SIGNED_URL_TTL_SECONDS });
  const url = new URL("/api/local-storage/download", apiBase);
  url.searchParams.set("token", makeLocalToken({ action: "download", key, filename }));
  return url.toString();
}

export async function getLocalDownload(token: string) {
  if (!localStorageEnabled) throw new Error("Local storage is disabled");
  const payload = readLocalToken(token, "download");
  const location = filePath(payload.key);
  await stat(location);
  return { location, filename: payload.filename || "download" };
}
