"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);

    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
      });
    } finally {
      startTransition(() => {
        router.push("/admin/login");
        router.refresh();
      });
      setIsPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isPending}>
      <LogOut className="size-4" />
      {isPending ? "Signing out" : "Sign out"}
    </Button>
  );
}