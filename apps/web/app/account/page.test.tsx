import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
const listAccountsMock = vi.fn();
const useSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
    listAccounts: (...args: unknown[]) => listAccountsMock(...args),
  },
}));

vi.mock("@/lib/user-identity", () => ({
  clearUserId: vi.fn(),
}));

async function loadAccountPage() {
  const pageModule = await import("./page");
  return pageModule.default;
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.resetModules();
    replaceMock.mockReset();
    listAccountsMock.mockReset();
    useSessionMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    useSessionMock.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "reader@example.com",
          name: "Reader",
        },
      },
      isPending: false,
    });

    listAccountsMock.mockResolvedValue({
      data: [
        {
          id: "acct-1",
          providerId: "github",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          accountId: "gh-1",
          userId: "user-1",
          scopes: [],
        },
        {
          id: "acct-2",
          providerId: "credential",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          accountId: "user-1",
          userId: "user-1",
          scopes: [],
        },
      ],
      error: null,
    });
  });

  it("redirects unauthenticated visitors to login with a next param", async () => {
    useSessionMock.mockReturnValue({
      data: null,
      isPending: false,
    });

    const AccountPage = await loadAccountPage();
    render(<AccountPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Faccount");
    });
  });

  it("renders session email, reader link, and read-only provider list", async () => {
    const AccountPage = await loadAccountPage();
    render(<AccountPage />);

    expect(await screen.findByText("reader@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open reader/i })).toHaveAttribute("href", "/reader");
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Email & password")).toBeInTheDocument();
    expect(screen.getAllByText("Linked")).toHaveLength(2);
    expect(listAccountsMock).toHaveBeenCalled();
  });

  it("calls the user delete API when Delete my data is confirmed", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const AccountPage = await loadAccountPage();
    render(<AccountPage />);

    await screen.findByText("reader@example.com");

    fireEvent.click(screen.getByRole("button", { name: /Delete my data/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/user/delete", {
        method: "DELETE",
        credentials: "same-origin",
      });
    });

    expect(await screen.findByText(/Your synced data has been deleted/i)).toBeInTheDocument();
  });
});
