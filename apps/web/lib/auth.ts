import { betterAuth } from "better-auth";
import { neon } from "@neondatabase/serverless";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) {
    return url;
  }

  // During static generation/build, we may not have the database URL.
  // Return a placeholder that will fail gracefully if actually used.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NODE_ENV === "production"
  ) {
    // pragma: allowlist secret - build-time placeholder, never used at runtime
    return "postgresql://user:pass@localhost:5432/placeholder?sslmode=require";
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

const sql = neon(getDatabaseUrl());

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  database: {
    provider: "pg",
    url: getDatabaseUrl(),
  },
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
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  cookiePrefix: "aiwf",
});

export type AuthSession = typeof auth.$Infer.Session;
