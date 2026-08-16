import { env } from "./env.js";

const frontendUrl = env.FRONTEND_URL.split(",")[0].trim().replace(/\/$/, "");

type Email = { to: string; subject: string; html: string };

async function sendEmail(message: Email) {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") console.warn(JSON.stringify({ level: "warn", message: "Email provider is not configured", subject: message.subject }));
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...message })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return true;
}

const shell = (title: string, body: string, action: string, url: string) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f211f"><p style="color:#b94843;text-transform:uppercase;letter-spacing:2px;font-size:12px">StoryBoard</p><h1>${title}</h1><p style="line-height:1.7">${body}</p><p><a href="${url}" style="display:inline-block;background:#1f211f;color:#fff;padding:12px 18px;border-radius:30px;text-decoration:none">${action}</a></p><p style="color:#777;font-size:12px">If you did not request this, you can ignore this email.</p></div>`;

export const notifications = {
  verify: (to: string, token: string) => sendEmail({ to, subject: "Verify your StoryBoard email", html: shell("Confirm your email", "Verify your address to finish setting up your private creator studio.", "Verify email", `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`) }),
  reset: (to: string, token: string) => sendEmail({ to, subject: "Reset your StoryBoard password", html: shell("Reset your password", "Use this secure link within one hour to choose a new password.", "Reset password", `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`) }),
  status: (to: string, submissionId: string, status: string) => sendEmail({ to, subject: `Submission ${submissionId} updated`, html: shell("Your submission has an update", `The status of ${submissionId} is now <strong>${status.replaceAll("_", " ")}</strong>.`, "Open your studio", `${frontendUrl}/creator/submissions`) }),
  message: (to: string, submissionId: string) => sendEmail({ to, subject: `New message about ${submissionId}`, html: shell("A reviewer sent you a message", "Sign in to your creator studio to read the message securely.", "Read message", `${frontendUrl}/creator/submissions`) })
};
