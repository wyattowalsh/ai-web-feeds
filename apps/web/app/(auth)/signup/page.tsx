"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Github, Chrome, UserPlus } from "lucide-react";
import { runPostAuthSync } from "@/hooks/use-account-merge";
import { hydrateFromServer } from "@/hooks/use-server-hydration";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function sanitizeNextPath(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default function SignupPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next")));
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = (provider: "google" | "github") => {
    setIsLoading(provider);
    setError(null);

    try {
      const callbackUrl = `${window.location.origin}${nextPath}`;
      const url = new URL(`/api/auth/signin/${provider}`, window.location.origin);
      url.searchParams.set("callbackUrl", callbackUrl);
      window.location.href = url.toString();
    } catch {
      setError("Unable to initiate sign-up. Please try again.");
      setIsLoading(null);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading("signup");
    setError(null);

    const result = await authClient.signUp.email({
      name: name.trim() || email.trim(),
      email: email.trim(),
      password,
      callbackURL: nextPath,
    });

    setIsLoading(null);

    if (result.error) {
      setError(result.error.message ?? "Unable to create your account.");
      return;
    }

    const session = await authClient.getSession();
    const sessionUserId = session.data?.user?.id?.trim();
    if (sessionUserId) {
      await runPostAuthSync({
        hydrate: () => hydrateFromServer({ sessionUserId }),
      });
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <div className="page-wrap page-stack">
      <section className="flex min-h-[70vh] items-center justify-center">
        <div className="surface-panel w-full max-w-lg space-y-6">
          <div className="space-y-3">
            <span className="eyebrow">
              <UserPlus className="size-3.5" />
              Create account
            </span>
            <div className="space-y-2">
              <h1 className="hero-title max-w-xl">Save your reader workspace.</h1>
              <p className="hero-copy max-w-lg">
                Create an account to keep saved searches, filters, and notification preferences tied
                to your identity instead of a browser-only anonymous profile.
              </p>
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSignUp}>
            <label htmlFor="signup-name" className="block space-y-2 text-sm">
              <span className="font-medium text-[color:var(--ink)]">Name</span>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label htmlFor="signup-email" className="block space-y-2 text-sm">
              <span className="font-medium text-[color:var(--ink)]">Email</span>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label htmlFor="signup-password" className="block space-y-2 text-sm">
              <span className="font-medium text-[color:var(--ink)]">Password</span>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            <Button type="submit" className="w-full gap-2" disabled={isLoading !== null}>
              <UserPlus className="size-4" />
              {isLoading === "signup" ? "Creating account..." : "Create account"}
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
              {isLoading === "google" ? "Continuing..." : "Continue with Google"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={isLoading !== null}
              onClick={() => handleSocialLogin("github")}
            >
              <Github className="size-4" />
              {isLoading === "github" ? "Continuing..." : "Continue with GitHub"}
            </Button>
          </div>

          <p className="small-note text-center">
            Already have an account?{" "}
            <Link href={`/login${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
