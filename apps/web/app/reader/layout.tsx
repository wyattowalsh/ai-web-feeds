import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export default function ReaderLayout({ children }: LayoutProps<"/reader">) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
