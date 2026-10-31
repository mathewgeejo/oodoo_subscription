import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import nodemailer from "nodemailer";
import { db } from "../db";
import { emailSchema, passwordSchema } from "../core/contracts";
import { configuredTrustedOrigins } from "./origins";

export function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || secret.startsWith("replace-") || !baseURL) throw new Error("Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL");
  return betterAuth({
    secret, baseURL,
    trustedOrigins: configuredTrustedOrigins(),
    database: prismaAdapter(db, { provider: "postgresql" }),
    user: { additionalFields: { role: { type: ["ADMIN", "STAFF", "CUSTOMER"], defaultValue: "CUSTOMER", input: false } } },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    emailAndPassword: {
      enabled: true, minPasswordLength: 9, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("Configure SMTP for password reset");
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_PORT === "465",
          auth: process.env.SMTP_USER ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD} : undefined,
        });
        await transporter.sendMail({ from: process.env.SMTP_FROM, to: user.email, subject: "Reset your Brightloop password", text: `Reset your password using this link (expires in 30 minutes):\n${url}` });
      },
    },
    hooks: {
      before: createAuthMiddleware(async context => {
        const body = context.body;
        if (!body) return;
        if (["/sign-up/email", "/sign-in/email", "/request-password-reset"].includes(context.path) && typeof body.email === "string") {
          const parsed = emailSchema.safeParse(body.email);
          if (!parsed.success) throw new APIError("BAD_REQUEST", { message: "Invalid email address" });
          body.email = parsed.data;
        }
        const password = context.path === "/reset-password" || context.path === "/change-password" ? body.newPassword : context.path === "/sign-up/email" ? body.password : undefined;
        if (password !== undefined && !passwordSchema.safeParse(password).success) throw new APIError("BAD_REQUEST", { message: "Password requires 9–128 characters, uppercase, lowercase and a special character" });
      }),
    },
    databaseHooks: { user: { create: { before: async user => ({ data: { ...user, email: emailSchema.parse(user.email), role: "CUSTOMER" } }) } } },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
