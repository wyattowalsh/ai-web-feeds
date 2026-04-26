import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: readFileSyncMock,
    default: {
      ...actual,
      readFileSync: readFileSyncMock,
    },
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/article-corpus", () => ({
  loadArticleCorpus: vi.fn(),
}));

vi.mock("@/lib/feeds", () => ({
  loadFeedCatalog: vi.fn(),
}));

describe("public content topic catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    readFileSyncMock.mockReset();
  });

  it("loads and caches valid topic records", async () => {
    readFileSyncMock.mockReturnValue(`
topics:
  - id: agents
    label: Agents
    description: Agent systems
    aliases:
      - agentic-ai
    parents: []
`);

    const { loadTopicCatalog } = await import("./public-content");

    expect(loadTopicCatalog()).toEqual([
      expect.objectContaining({
        id: "agents",
        label: "Agents",
        description: "Agent systems",
        aliases: ["agentic-ai"],
        parents: [],
      }),
    ]);
    expect(loadTopicCatalog()).toHaveLength(1);
    expect(readFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it("throws when topics.yaml cannot be read", async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { loadTopicCatalog } = await import("./public-content");

    expect(() => loadTopicCatalog()).toThrow(
      "Failed to load topic catalog from data/topics.yaml: ENOENT",
    );
  });

  it("throws when topics.yaml does not contain a topics array", async () => {
    readFileSyncMock.mockReturnValue("topics: nope");

    const { loadTopicCatalog } = await import("./public-content");

    expect(() => loadTopicCatalog()).toThrow("Expected topics.yaml to contain a topics array");
  });
});
