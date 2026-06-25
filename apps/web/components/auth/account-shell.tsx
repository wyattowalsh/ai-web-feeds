"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Chrome, Github, KeyRound, Mail, Trash2, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearUserId } from "@/lib/user-identity";

type LinkedAccount = {
  id: string;
  providerId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  accountId: string;
  userId: string;
  scopes?: string[];
};

function formatProviderLabel(providerId: string): string {
  switch (providerId) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "credential":
      return "Email & password";
    default:
      return providerId;
  }
}

function ProviderIcon({ providerId }: { providerId: string }) {
  switch (providerId) {
    case "google":
      return <Chrome className="size-4" aria-hidden />;
    case "github":
      return <Github className="size-4" aria-hidden />;
    case "credential":
      return <KeyRound className="size-4" aria-hidden />;
    default:
      return <Mail className="size-4" aria-hidden />;
  }
}

export function AccountShell() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session?.user) {
      router.replace("/login?next=%2Faccount");
    }
  }, [isPending, router, session?.user]);

  const loadAccounts = useCallback(async () => {
    if (!session?.user) {
      return;
    }

    setAccountsLoading(true);
    setAccountsError(null);

    const result = await authClient.listAccounts();

    setAccountsLoading(false);

    if (result.error) {
      setAccountsError(result.error.message ?? "Unable to load sign-in methods.");
      setAccounts([]);
      return;
    }

    setAccounts((result.data ?? []) as LinkedAccount[]);
  }, [session?.user]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleDeleteData = async () => {
    if (
      !confirm(
        "Delete all saved data tied to your account? Saved filters, searches, follows, and preferences will be removed. This cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteMessage(null);

    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to delete your data.");
      }

      clearUserId();
      setDeleteMessage("Your synced data has been deleted.");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete your data.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isPending || !session?.user) {
    return (
      <div className="page-wrap page-stack">
        <section className="flex min-h-[50vh] items-center justify-center">
          <div className="surface-card w-full max-w-lg space-y-3 text-center">
            <p className="metric-label">Account</p>
            <p className="text-sm text-(--ink-muted)">
              {isPending ? "Loading your session..." : "Redirecting to sign in..."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  const email = session.user.email;

  return (
    <div className="page-wrap page-stack">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="surface-panel space-y-6">
          <div className="space-y-3">
            <span className="eyebrow">
              <UserCircle2 className="size-3.5" />
              Account
            </span>
            <div className="space-y-2">
              <h1 className="hero-title max-w-xl">Your signed-in profile.</h1>
              <p className="hero-copy max-w-lg">
                Review the email tied to your session, jump back to the reader, and manage synced
                data stored for this account.
              </p>
            </div>
          </div>

          <div className="surface-card space-y-2">
            <p className="metric-label">Session email</p>
            <p className="text-base font-medium text-(--ink)">{email}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" className="gap-2" asChild>
              <Link href="/reader">
                <BookOpen className="size-4" />
                Open reader
              </Link>
            </Button>
          </div>
        </div>

        <div className="surface-card space-y-4">
          <div className="space-y-1">
            <p className="metric-label">Sign-in methods</p>
            <p className="small-note">Linked providers for this account (read-only).</p>
          </div>

          {accountsLoading ? (
            <p className="text-sm text-(--ink-muted)">Loading sign-in methods...</p>
          ) : null}

          {accountsError ? (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {accountsError}
            </p>
          ) : null}

          {!accountsLoading && !accountsError && accounts.length === 0 ? (
            <p className="text-sm text-(--ink-muted)">No linked providers found.</p>
          ) : null}

          {!accountsLoading && accounts.length > 0 ? (
            <ul className="space-y-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="surface-card-soft flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-(--brand-soft) text-(--brand-strong)">
                      <ProviderIcon providerId={account.providerId} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-(--ink)">
                        {formatProviderLabel(account.providerId)}
                      </p>
                      <p className="text-xs text-(--ink-muted)">Connected to {email}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-(--line) px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-(--ink-muted)">
                    Linked
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="surface-card space-y-4 border-(--danger-tone)/30">
          <div className="space-y-1">
            <p className="metric-label">Delete my data</p>
            <p className="small-note">
              Remove synced searches, filters, follows, preferences, and article state from the
              server. Your sign-in account remains unless you delete it separately.
            </p>
          </div>

          {deleteError ? (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </p>
          ) : null}

          {deleteMessage ? (
            <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {deleteMessage}
            </p>
          ) : null}

          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={isDeleting}
            onClick={() => void handleDeleteData()}
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete my data"}
          </Button>
        </div>
      </section>
    </div>
  );
}
