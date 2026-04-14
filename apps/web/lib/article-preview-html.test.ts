import { describe, expect, it } from "vitest";

import { sanitizeArticlePreviewHtml } from "./article-preview-html";

function renderSanitized(html: string, articleUrl = "https://example.com/posts/agent-roundup") {
  const sanitized = sanitizeArticlePreviewHtml(html, articleUrl);
  const container = document.createElement("div");
  container.innerHTML = sanitized ?? "";
  return { sanitized, container };
}

describe("sanitizeArticlePreviewHtml", () => {
  it("removes blocked elements and unsafe attributes", () => {
    const { container } = renderSanitized(
      [
        '<p style="color:red" onclick="alert(1)">Safe <strong>text</strong></p>',
        '<script>alert("bad")</script>',
        '<iframe src="https://evil.example/embed"></iframe>',
        '<form action="/submit"><button>Submit</button></form>',
      ].join(""),
    );

    const paragraph = container.querySelector("p");
    expect(paragraph).not.toBeNull();
    expect(paragraph).not.toHaveAttribute("style");
    expect(paragraph).not.toHaveAttribute("onclick");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container).not.toHaveTextContent("Submit");
    expect(container).toHaveTextContent("Safe text");
  });

  it("rejects unsafe URLs while preserving safe links", () => {
    const { container } = renderSanitized(
      [
        '<a href="javascript:alert(1)">Bad link</a>',
        '<a href="/safe/path">Good link</a>',
        '<img src="data:text/plain,hello" alt="Bad image">',
      ].join(""),
    );

    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const link = container.querySelector("a[href='https://example.com/safe/path']");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(container).toHaveTextContent("Bad link");
  });

  it("preserves safe rich markup like tables, code blocks, and images", () => {
    const { container } = renderSanitized(
      [
        '<figure><img src="https://cdn.example.com/cover.png" alt="Cover image"></figure>',
        "<table><thead><tr><th scope='col'>Topic</th></tr></thead><tbody><tr><td>Agents</td></tr></tbody></table>",
        "<pre><code>const ok = true;</code></pre>",
      ].join(""),
    );

    expect(container.querySelector("figure img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/cover.png",
    );
    expect(container.querySelector("figure img")).toHaveAttribute("alt", "Cover image");
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("th")).toHaveAttribute("scope", "col");
    expect(container.querySelector("pre code")).not.toBeNull();
    expect(container).toHaveTextContent("const ok = true;");
  });

  it("resolves relative links and image sources against the article URL", () => {
    const { container } = renderSanitized(
      ['<a href="../source">Source</a>', '<img src="/images/cover.png" alt="Resolved image">'].join(
        "",
      ),
      "https://example.com/posts/2026/agent-roundup",
    );

    expect(container.querySelector("a")).toHaveAttribute(
      "href",
      "https://example.com/posts/source",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/images/cover.png",
    );
  });
});
