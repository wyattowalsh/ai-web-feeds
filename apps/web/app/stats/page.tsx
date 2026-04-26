import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard - AI Web Feeds",
  description: "Compatibility route for the compact AI Web Feeds dashboard.",
};

export default function StatsPage() {
  redirect("/dashboard");
}
