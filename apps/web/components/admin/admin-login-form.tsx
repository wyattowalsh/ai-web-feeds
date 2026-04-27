"use client";

import { useState } from "react";
import { ShieldCheck, Github, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminLoginFormProps = {
  nextPath: string;
};

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
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
      setError("Unable to initiate sign-in. Please try again.");
      setIsLoading(null);
    }
  };

  return (
    <div className="surface-panel w-full max-w-lg space-y-6">
      <div className="space-y-3">
        <span className="eyebrow">
          <ShieldCheck className="size-3.5" />
          Admin access
        </span>
        <div className="space-y-2">
          <h1 className="hero-title max-w-xl">Protected observability for API telemetry.</h1>
          <p className="hero-copy max-w-lg">
            Sign in with your Google or GitHub account to access the admin panel. Only authorized
            admin accounts are granted access.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={isLoading !== null}
          onClick={() => handleSocialLogin("google")}
        >
          <Chrome className="size-4" />
          {isLoading === "google" ? "Signing in..." : "Sign in with Google"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={isLoading !== null}
          onClick={() => handleSocialLogin("github")}
        >
          <Github className="size-4" />
          {isLoading === "github" ? "Signing in..." : "Sign in with GitHub"}
        </Button>
      </div>

      <p className="small-note text-center">
        Only pre-authorized accounts can access the admin panel.
      </p>
    </div>
  );
}
