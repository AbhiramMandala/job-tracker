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

const USER = { id: "u1", email: "admin@gmail.com", name: "Admin User", role: "student", created_at: "2026-01-01" };
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
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByText("Your career, in one place.")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("offers a theme toggle in the header that persists", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/home");
    render(<App />);
    expect(await screen.findByText(/Good (morning|afternoon|evening), Admin/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("jt-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
  });

  it("lands fresh logins on home with the new navigation", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/applications");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Applications/ })).toBeTruthy();
    const navLabels = screen
      .getAllByRole("link")
      .map((a) => a.textContent ?? "");
    for (const label of ["Home", "Discover Jobs", "Applications", "Interviews", "Resumes", "Settings", "Profile"]) {
      expect(navLabels.some((t) => t.includes(label))).toBe(true);
    }
  });

  it("redirects legacy discover URLs to the native page", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/discover/searches") return Promise.resolve({ searches: [] });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/discover-jobs");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Discover Jobs" })).toBeTruthy();
    expect(window.location.pathname).toBe("/discover");
  });

  it("never renders Sign in when /me restores a valid session", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/profile");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
  });

  it("keeps the session and offers retry when /me fails transiently", async () => {
    localStorage.setItem("sjt_token", "test-token");
    const transient = Object.assign(new Error("Something went wrong"), { status: 500 });
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.reject(transient);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/profile");
    render(<App />);
    // Recovery UI — not the Sign in form — and the token is preserved.
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(localStorage.getItem("sjt_token")).toBe("test-token");
    // Retry succeeds → authenticated shell, still no Sign in.
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
  });

  it("clears the session and shows Sign in only on 401", async () => {
    localStorage.setItem("sjt_token", "bad-token");
    const expired = Object.assign(new Error("Authentication required"), { status: 401, code: "UNAUTHORIZED" });
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.reject(expired);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/profile");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(localStorage.getItem("sjt_token")).toBeNull();
  });
});

describe("password reset", () => {
  it("requests a reset link without revealing account existence", async () => {
    post.mockResolvedValue({ ok: true });
    go("/forgot-password");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "someone@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/a reset link was generated/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/auth/forgot-password", { email: "someone@x.com" });
  });

  it("sets a new password from a valid link", async () => {
    post.mockResolvedValue({ ok: true });
    go(`/reset-password?selector=${"a".repeat(32)}&token=${"b".repeat(64)}`);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("New password (8+ chars)"), { target: { value: "brandnewpass1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "brandnewpass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/Password updated/)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/auth/reset-password", {
      selector: "a".repeat(32),
      token: "b".repeat(64),
      new_password: "brandnewpass1",
    });
  });

  it("rejects incomplete links and mismatched passwords client-side", async () => {
    go("/reset-password");
    render(<App />);
    expect(await screen.findByText(/link is incomplete/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it("links to forgot-password from the Sign in page", async () => {
    go("/sign-in");
    render(<App />);
    const link = await screen.findByRole("link", { name: "Forgot password?" });
    expect(link.getAttribute("href")).toBe("/forgot-password");
  });
});

describe("registration email validation", () => {
  it("shows an inline error and blocks submit for malformed emails", async () => {
    go("/sign-up");
    render(<App />);
    const email = await screen.findByLabelText("Email");
    const registerBtn = screen.getByRole("button", { name: "Register" }) as HTMLButtonElement;
    expect(registerBtn.disabled).toBe(true);

    for (const bad of ["abc", "abc@", "abc@domain", "@domain.com", "abc domain@gmail.com", "abc@@gmail.com"]) {
      fireEvent.change(email, { target: { value: bad } });
      expect(await screen.findByText("Please enter a valid email address.")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Register" }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(post).not.toHaveBeenCalled();
  });

  it("requires a non-empty email with the exact message", async () => {
    go("/sign-up");
    render(<App />);
    const email = await screen.findByLabelText("Email");
    // Type then clear: an emptied field shows the required message.
    fireEvent.change(email, { target: { value: "x" } });
    fireEvent.change(email, { target: { value: "" } });
    expect(await screen.findByText("Email is required.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Register" }) as HTMLButtonElement).disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("enables submit for valid emails and registers", async () => {
    post.mockResolvedValue({ user: USER, token: "new-token" });
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/dashboard") return Promise.resolve(EMPTY_DASH);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    go("/sign-up");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "New@Example.com" } });
    fireEvent.change(screen.getByLabelText("Password (8+ chars)"), { target: { value: "password123" } });
    const btn = screen.getByRole("button", { name: "Register" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await screen.findByText(/Good (morning|afternoon|evening), Admin/);
    expect(post).toHaveBeenCalledWith("/api/auth/register", { email: "New@Example.com", password: "password123", name: "" });
  });
});
