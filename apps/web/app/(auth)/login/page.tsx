"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Github, Chrome, LogIn, Mail } from "lucide-react";
import { runPostAuthSync } from "@/hooks/use-account-merge";
import { hydrateFromServer } from "@/hooks/use-server-hydration";
import { authClient } from "@/lib/auth-client";
import { getStoredUserId } from "@/lib/user-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function sanitizeNextPath(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next")));
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = (provider: "google" | "github") => {
    setIsLoading(provider);
    setError(null);
    setMessage(null);

    try {
      const callbackUrl = `${window.location.origin}${nextPath}`;
      const url = new URL(`/api/auth/signin/${provider}`, window.location.origin);
      url.searchParams.set("callbackUrl", callbackUrl);
      window.location.href = url.toString();
    } catch {
      setError("Unable to initiate sign-in. Please try again.");
      setIsLoading(null);
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading("password");
    setError(null);
    setMessage(null);

    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
      callbackURL: nextPath,
    });

    setIsLoading(null);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in with email and password.");
      return;
    }

    const session = await authClient.getSession();
    const sessionUserId = session.data?.user?.id?.trim();
    if (sessionUserId) {
      await runPostAuthSync({
        hydrate: () => hydrateFromServer({ sessionUserId }),
      });
    } else {
      const anonUserId = getStoredUserId();
      if (anonUserId) {
        console.info("[aiwf] Signed in; account merge will run after session is established.");
      }
    }

    router.push(nextPath);
    router.refresh();
  };

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading("magic");
    setError(null);
    setMessage(null);

    const result = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: nextPath,
    });

    setIsLoading(null);

    if (result.error) {
      setError(result.error.message ?? "Unable to send a magic link.");
      return;
    }

    setMessage(
      "Check your inbox for a sign-in link. In development, the link is logged to the server console.",
    );
  };

  return (
    <div className="page-wrap page-stack">
      <section className="flex min-h-[70vh] items-center justify-center">
        <div className="surface-panel w-full max-w-lg space-y-6">
          <div className="space-y-3">
            <span className="eyebrow">
              <LogIn className="size-3.5" />
              Sign in
            </span>
            <div className="space-y-2">
              <h1 className="hero-title max-w-xl">Pick up where you left off.</h1>
              <p className="hero-copy max-w-lg">
                Use email, a magic link, or your Google or GitHub account to sync saved searches,
                filters, and preferences across devices.
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="Sign-in method"
            className="flex gap-2 rounded-2xl border border-[color:var(--line)] p-1"
          >
            <Button
              type="button"
              role="tab"
              aria-selected={mode === "password"}
              variant={mode === "password" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("password")}
            >
              Password
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={mode === "magic"}
              variant={mode === "magic" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("magic")}
            >
              Magic link
            </Button>
          </div>

          <form
            className="space-y-4"
            data-mode={mode}
            onSubmit={mode === "password" ? handlePasswordSignIn : handleMagicLink}
          >
            <label htmlFor="login-email" className="block space-y-2 text-sm">
              <span className="font-medium text-[color:var(--ink)]">Email</span>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            {mode === "password" ? (
              <label
                htmlFor="login-password"
                className="block space-y-2 text-sm"
                data-testid="login-password-field"
              >
                <span className="font-medium text-[color:var(--ink)]">Password</span>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                />
              </label>
            ) : null}

            <Button type="submit" className="w-full gap-2" disabled={isLoading !== null}>
              {mode === "password" ? <LogIn className="size-4" /> : <Mail className="size-4" />}
              {isLoading === "password"
                ? "Signing in..."
                : isLoading === "magic"
                  ? "Sending link..."
                  : mode === "password"
                    ? "Sign in"
                    : "Email magic link"}
            </Button>
          </form>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={isLoading !== null}
              onClick={() => handleSocialLogin("google")}
            >
              <Chrome className="size-4" />
              {isLoading === "google" ? "Signing in..." : "Continue with Google"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={isLoading !== null}
              onClick={() => handleSocialLogin("github")}
            >
              <Github className="size-4" />
              {isLoading === "github" ? "Signing in..." : "Continue with GitHub"}
            </Button>
          </div>

          <p className="small-note text-center">
            New here?{" "}
            <Link
              href={`/signup${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
