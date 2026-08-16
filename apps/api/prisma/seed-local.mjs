import { PrismaClient, Role } from "../generated/local/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = "admin@sb.com";
const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";

await prisma.user.updateMany({
  where: { role: Role.ADMIN, email: { not: email } },
  data: { role: Role.CREATOR }
});

await prisma.user.upsert({
  where: { email },
  update: { role: Role.ADMIN, active: true, emailVerified: true },
  create: { name: "Platform Admin", email, role: Role.ADMIN, emailVerified: true, passwordHash: await bcrypt.hash(password, 12) }
});

console.log(`Local admin ready: ${email}`);
await prisma.$disconnect();
