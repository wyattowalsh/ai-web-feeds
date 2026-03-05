import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Mermaid } from "@/components/mdx/mermaid";
import * as Python from "fumadocs-python/components";
import * as LucideIcons from "lucide-react";
import type { ComponentProps } from "react";

// Enable printing mode via environment variable
const isPrinting = process.env.NEXT_PUBLIC_PDF_EXPORT === "true";

/**
 * Custom Accordion component for printing that displays content without collapsing
 */
function PrintingAccordion(props: ComponentProps<typeof Accordion>) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>{props.title}</h3>
      <div>{props.children}</div>
    </div>
  );
}

/**
 * Custom Tab component for printing that displays all tab content
 */
function PrintingTab(props: ComponentProps<typeof Tab>) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <h4 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>{props.title}</h4>
      <div>{props.children}</div>
    </div>
  );
}

// use this function to get MDX components, you will need it for rendering MDX
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...Python,
    ...LucideIcons,
    Mermaid,
    // Override components when in printing mode to show all content
    ...(isPrinting && {
      Accordion: PrintingAccordion,
      Accordions: "div" as any,
      Tab: PrintingTab,
      Tabs: "div" as any,
    }),
    ...components,
  };
}
