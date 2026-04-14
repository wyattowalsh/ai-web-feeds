"use client";

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const DROP_SUBTREE_TAGS = new Set([
  "audio",
  "button",
  "canvas",
  "embed",
  "fieldset",
  "form",
  "head",
  "iframe",
  "input",
  "link",
  "meta",
  "noscript",
  "object",
  "option",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "template",
  "textarea",
  "video",
]);

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SAFE_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);
const TABLE_SCOPE_VALUES = new Set(["row", "col", "rowgroup", "colgroup"]);

type SanitizedElement = HTMLElement | HTMLTableCellElement | HTMLImageElement | HTMLAnchorElement;

export function sanitizeArticlePreviewHtml(
  html: string | null | undefined,
  articleUrl: string,
): string | null {
  const trimmed = html?.trim() ?? "";
  if (!trimmed || !/<\/?[a-z][\s\S]*>/i.test(trimmed) || typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(trimmed, "text/html");
  const sanitizedRoot = sourceDocument.createElement("div");

  for (const child of Array.from(sourceDocument.body.childNodes)) {
    for (const sanitizedNode of sanitizeNode(child, sourceDocument, articleUrl)) {
      sanitizedRoot.appendChild(sanitizedNode);
    }
  }

  const sanitizedHtml = sanitizedRoot.innerHTML.trim();
  return sanitizedHtml.length > 0 ? sanitizedHtml : null;
}

function sanitizeNode(node: Node, document: Document, articleUrl: string): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [document.createTextNode(node.textContent ?? "")];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (DROP_SUBTREE_TAGS.has(tagName)) {
    return [];
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    return sanitizeChildren(element, document, articleUrl);
  }

  const sanitizedElement = document.createElement(tagName) as SanitizedElement;
  copyAllowedAttributes(element, sanitizedElement, articleUrl);

  for (const child of sanitizeChildren(element, document, articleUrl)) {
    sanitizedElement.appendChild(child);
  }

  if (tagName === "a" && !sanitizedElement.getAttribute("href")) {
    return sanitizeChildren(element, document, articleUrl);
  }

  if (tagName === "img") {
    if (!sanitizedElement.getAttribute("src")) {
      return [];
    }

    if (!sanitizedElement.getAttribute("alt")) {
      sanitizedElement.setAttribute("alt", "");
    }
  }

  return [sanitizedElement];
}

function sanitizeChildren(element: HTMLElement, document: Document, articleUrl: string): Node[] {
  return Array.from(element.childNodes).flatMap((child) =>
    sanitizeNode(child, document, articleUrl),
  );
}

function copyAllowedAttributes(
  sourceElement: HTMLElement,
  targetElement: SanitizedElement,
  articleUrl: string,
): void {
  const title = sourceElement.getAttribute("title")?.trim();
  if (title) {
    targetElement.setAttribute("title", title);
  }

  const dir = sourceElement.getAttribute("dir")?.trim();
  if (dir === "ltr" || dir === "rtl" || dir === "auto") {
    targetElement.setAttribute("dir", dir);
  }

  const lang = sourceElement.getAttribute("lang")?.trim();
  if (lang) {
    targetElement.setAttribute("lang", lang);
  }

  if (targetElement instanceof HTMLAnchorElement) {
    const href = sanitizeUrl(sourceElement.getAttribute("href"), articleUrl, SAFE_LINK_PROTOCOLS);
    if (href) {
      targetElement.setAttribute("href", href);
      targetElement.setAttribute("target", "_blank");
      targetElement.setAttribute("rel", "noreferrer noopener");
    }
    return;
  }

  if (targetElement instanceof HTMLImageElement) {
    const src = sanitizeUrl(sourceElement.getAttribute("src"), articleUrl, SAFE_IMAGE_PROTOCOLS);
    if (src) {
      targetElement.setAttribute("src", src);
    }

    const alt = sourceElement.getAttribute("alt")?.trim();
    if (alt) {
      targetElement.setAttribute("alt", alt);
    }
    return;
  }

  if (targetElement instanceof HTMLTableCellElement) {
    const colspan = sanitizePositiveInteger(sourceElement.getAttribute("colspan"));
    if (colspan) {
      targetElement.setAttribute("colspan", colspan);
    }

    const rowspan = sanitizePositiveInteger(sourceElement.getAttribute("rowspan"));
    if (rowspan) {
      targetElement.setAttribute("rowspan", rowspan);
    }

    if (targetElement.tagName.toLowerCase() === "th") {
      const scope = sourceElement.getAttribute("scope")?.trim().toLowerCase();
      if (scope && TABLE_SCOPE_VALUES.has(scope)) {
        targetElement.setAttribute("scope", scope);
      }
    }
  }
}

function sanitizeUrl(
  value: string | null,
  articleUrl: string,
  allowedProtocols: ReadonlySet<string>,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolvedUrl = new URL(trimmed, articleUrl);
    return allowedProtocols.has(resolvedUrl.protocol) ? resolvedUrl.toString() : null;
  } catch {
    return null;
  }
}

function sanitizePositiveInteger(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return String(Math.trunc(parsed));
}
