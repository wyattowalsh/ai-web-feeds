import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { neon } from "@neondatabase/serverless";

type AuthEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

async function deliverAuthEmail(payload: AuthEmailPayload): Promise<void> {
  const from = process.env.BETTER_AUTH_EMAIL_FROM ?? "AI Web Feeds <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (apiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? payload.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[auth-email] Resend failed:", response.status, body);
      throw new Error("Failed to send auth email");
    }

    return;
  }

  console.info("[auth-email] Dev fallback — set RESEND_API_KEY to send real email");
  console.info(`  To: ${payload.to}`);
  console.info(`  Subject: ${payload.subject}`);
  console.info(`  Body:\n${payload.text}`);
}

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return url;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  return null;
}

function getAdminEmails(): Set<string> {
  const raw = process.env.BETTER_AUTH_ADMIN_EMAILS?.trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function createAuthInstance() {
  const databaseUrl = getDatabaseUrl();
  const sql = databaseUrl ? neon(databaseUrl) : null;
  const adminEmails = getAdminEmails();

  return betterAuth({
    baseURL: getBaseUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    ...(databaseUrl
      ? {
          database: {
            provider: "pg" as const,
            url: databaseUrl,
          },
        }
      : {}),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await deliverAuthEmail({
            to: email,
            subject: "Sign in to AI Web Feeds",
            text: `Sign in to AI Web Feeds:\n\n${url}\n\nThis link expires in 5 minutes.`,
            html: `<p>Sign in to AI Web Feeds:</p><p><a href="${url}">${url}</a></p><p>This link expires in 5 minutes.</p>`,
          });
        },
      }),
    ],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          default: "user",
        },
      },
    },
    ...(sql && adminEmails.size > 0
      ? {
          databaseHooks: {
            user: {
              create: {
                after: async (user) => {
                  if (adminEmails.has(user.email.toLowerCase())) {
                    await sql`UPDATE "user" SET role = 'admin' WHERE id = ${user.id}`;
                  }
                },
              },
            },
          },
        }
      : {}),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    cookiePrefix: "aiwf",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuthInstance();
  }
  return authInstance as ReturnType<typeof betterAuth>;
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, prop, receiver) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

export type AuthSession = ReturnType<typeof getAuth>["$Infer"]["Session"];
