import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackend } from "@/lib/backend";
import { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");
  return {
    ...actual,
    fetchBackend: vi.fn(),
  };
});

import { DELETE, GET, POST } from "./route";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("/api/search/saved route", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("mints anonymous binding and forwards scoped user id on GET", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const response = await GET(createRequest("http://localhost/api/search/saved"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/saved_searches", {
      method: "GET",
      params: {
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });

  it("uses bound user id for POST create", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ id: "saved-1" });

    const response = await POST(
      createRequest("http://localhost/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_name: "My Search",
          query_text: "ml systems",
          filters: {},
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/saved_searches", {
      method: "POST",
      body: expect.objectContaining({
        search_name: "My Search",
        query_text: "ml systems",
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    });
  });

  it("normalizes saved-search query text and filters before forwarding", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ id: "saved-1" });

    const response = await POST(
      createRequest("http://localhost/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search_name: "  My Search  ",
          query_text: "  ml   systems  ",
          filters: {
            search_type: "semantic",
            topics: ["ml", " agents ", "ml"],
            verified: "true",
            threshold: "0.2",
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/saved_searches", {
      method: "POST",
      body: expect.objectContaining({
        search_name: "My Search",
        query_text: "ml systems",
        filters: {
          search_type: "articles",
          topics: ["ml", "agents"],
          verified: true,
          threshold: 0.5,
        },
      }),
    });
  });

  it("encodes search id in delete path", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const response = await DELETE(
      createRequest("http://localhost/api/search/saved?id=abc/def?x=1"),
    );

    expect(response.status).toBe(200);
    expect(fetchBackend).toHaveBeenCalledWith("/storage/saved_searches/abc%2Fdef%3Fx%3D1", {
      method: "DELETE",
      params: {
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });

  it("rejects user-scoped requests until a binding cookie exists", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const getResponse = await GET(
      createRequest(
        "http://localhost/api/search/saved?user_id=11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(getResponse.status).toBe(403);

    const postResponse = await POST(
      createRequest("http://localhost/api/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "11111111-1111-4111-8111-111111111111",
          search_name: "My Search",
          query_text: "ml systems",
          filters: {},
        }),
      }),
    );
    expect(postResponse.status).toBe(403);
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("accepts a matching user_id once the anonymous binding exists", async () => {
    vi.mocked(fetchBackend).mockResolvedValue([]);

    const bootstrapResponse = await GET(createRequest("http://localhost/api/search/saved"));
    const bindingCookie = bootstrapResponse.headers.get("set-cookie");
    const boundUserId = bootstrapResponse.headers.get(ANON_USER_ID_RESPONSE_HEADER);

    expect(bindingCookie).toContain(ANON_USER_BINDING_COOKIE);
    expect(boundUserId).toBeTruthy();

    const response = await GET(
      createRequest(`http://localhost/api/search/saved?user_id=${boundUserId}`, {
        headers: {
          cookie: bindingCookie!,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchBackend).toHaveBeenLastCalledWith("/storage/saved_searches", {
      method: "GET",
      params: {
        user_id: boundUserId,
      },
    });
  });
});
