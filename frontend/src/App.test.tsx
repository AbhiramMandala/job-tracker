import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "./App";

vi.mock("./services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "./services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;

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
    // RequireAuth bounces to login; no Tracker data is fetched or shown.
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(get).not.toHaveBeenCalledWith("/api/dashboard");
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
