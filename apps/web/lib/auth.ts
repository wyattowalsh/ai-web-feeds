import { betterAuth } from "better-auth";
import { neon } from "@neondatabase/serverless";

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL;
  if (url) {
    return url;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  throw new Error(
    "No database connection string was provided. Set DATABASE_URL in your environment.",
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

const databaseUrl = getDatabaseUrl();
const sql = databaseUrl ? neon(databaseUrl) : null;

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  ...(databaseUrl
    ? {
        database: {
          provider: "pg" as const,
          url: databaseUrl,
        },
      }
    : {}),
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
  ...(sql
    ? {
        databaseHooks: {
          user: {
            create: {
              after: async (user) => {
                if (user.email === "wyattowalsh@gmail.com") {
                  await sql`UPDATE "user" SET role = 'admin' WHERE id = ${user.id}`;
                }
              },
            },
          },
        },
      }
    : {}),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  cookiePrefix: "aiwf",
});

export type AuthSession = typeof auth.$Infer.Session;
