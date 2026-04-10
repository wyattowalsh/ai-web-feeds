import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

type FeedsLayoutProps = {
  children: ReactNode;
};

export default function FeedsLayout({ children }: FeedsLayoutProps) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
