import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const production = process.env.NODE_ENV === "production";
const email = process.env.ADMIN_EMAIL || (production ? "" : "admin@sb.com");
const password = process.env.ADMIN_PASSWORD || (production ? "" : "ChangeMe123!");

if (!email || !password || (production && password === "ChangeMe123!")) {
  throw new Error("ADMIN_EMAIL and a secure ADMIN_PASSWORD are required in production");
}

await prisma.user.upsert({
  where: { email },
  update: { role: Role.ADMIN, active: true, emailVerified: true },
  create: { name: "Platform Admin", email, role: Role.ADMIN, emailVerified: true, passwordHash: await bcrypt.hash(password, 12) }
});
console.log(`Admin ready: ${email}`);
await prisma.$disconnect();
