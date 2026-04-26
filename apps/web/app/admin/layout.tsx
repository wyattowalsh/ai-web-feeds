import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin - AI Web Feeds",
  robots: noIndexRobots,
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
