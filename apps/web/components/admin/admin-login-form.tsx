"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminLoginFormProps = {
  nextPath: string;
};

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, next: nextPath }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { authenticated?: boolean; next?: string; error?: string }
        | null;

      if (!response.ok || !payload?.authenticated) {
        setError(payload?.error ?? "Unable to authenticate admin session");
        return;
      }

      startTransition(() => {
        router.push(payload.next || "/admin");
        router.refresh();
      });
    } catch {
      setError("Unable to authenticate admin session");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface-panel w-full max-w-lg space-y-6">
      <div className="space-y-3">
        <span className="eyebrow">
          <ShieldCheck className="size-3.5" />
          Admin access
        </span>
        <div className="space-y-2">
          <h1 className="hero-title max-w-xl">Protected observability for API telemetry.</h1>
          <p className="hero-copy max-w-lg">
            This panel is guarded by a server-only shared secret and issues a signed admin session cookie after successful authentication.
          </p>
        </div>
      </div>

      <label className="space-y-2 text-sm font-medium text-(--ink)">
        <span>Admin password</span>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter the admin password"
          required
        />
      </label>

      {error ? <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          <LockKeyhole className="size-4" />
          {isSubmitting ? "Unlocking" : "Unlock admin"}
        </Button>
        <p className="small-note">Failed attempts are rate limited server-side.</p>
      </div>
    </form>
  );
}