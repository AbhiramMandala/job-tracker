import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

vi.mock("./services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "./services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const USER = { id: "u1", email: "admin@gmail.com", name: "Admin User", created_at: "2026-01-01" };
const EMPTY_DASH = {
  totals: { total: 0, applied: 0, interviewing: 0, offers: 0, rejected: 0, saved: 0 },
  byStatus: [],
  upcomingInterviews: [],
  recentApplications: [],
  overdueFollowUps: [],
  upcomingFollowUps: [],
};

function go(path: string) {
  window.history.pushState({}, "", path);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  go("/");
});

describe("auth-gated routing", () => {
  it("shows the public landing at / without authentication", async () => {
    go("/");
    render(<App />);
    expect(await screen.findByText("Your career, in one place.")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Sign up" })).toHaveLength(2);
    expect(get).not.toHaveBeenCalled();
  });

  it("sends logged-in visitors from / to home", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/");
    render(<App />);
    expect(await screen.findByText(/Good (morning|afternoon|evening), Admin/)).toBeTruthy();
    expect(window.location.pathname).toBe("/home");
  });

  it("keeps legacy /login working via redirect", async () => {
    go("/login");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(window.location.pathname).toBe("/sign-in");
  });
  it("sends logged-in users from /dashboard to the new home", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/dashboard");
    render(<App />);
    // Old bookmark still works via redirect, landing on the command center.
    expect(await screen.findByText(/Good (morning|afternoon|evening), Admin/)).toBeTruthy();
    expect(window.location.pathname).toBe("/home");
  });

  it("blocks unauthenticated access to protected pages", async () => {
    go("/home");
    render(<App />);
    // RequireAuth bounces to sign-in; no Tracker data is fetched or shown.
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(window.location.pathname).toBe("/sign-in");
    expect(get).not.toHaveBeenCalledWith("/api/dashboard");
  });

  it("returns to the public landing after logout", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    post.mockResolvedValue({});
    go("/home");
    render(<App />);
    expect(await screen.findByText(/Good (morning|afternoon|evening), Admin/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByText("Your career, in one place.")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("lands fresh logins on home with the new navigation", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/discover-jobs");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Discover Jobs" })).toBeTruthy();
    const navLabels = screen
      .getAllByRole("link")
      .map((a) => a.textContent ?? "");
    for (const label of ["Home", "Applications", "Interviews", "Resumes", "Discover Jobs", "Settings"]) {
      expect(navLabels.some((t) => t.includes(label))).toBe(true);
    }
  });
});
