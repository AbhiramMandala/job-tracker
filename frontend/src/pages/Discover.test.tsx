import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { DiscoverPage } from "./Discover";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const USER = { id: "u1", email: "a@b.com", name: "Al", role: "student", created_at: "2026-01-01" };
const notify = vi.fn();

const JOBS = [
  { id: "abc123", title: "Python Developer", company: "Acme", location: "Hyderabad", description: "Build APIs.", apply_url: "https://example.com/a", source: "LinkedIn", posted_at: "2 days ago", salary: "", employment_type: "FULL_TIME", remote: true },
  { id: "def456", title: "Junior QA", company: "Beta", location: "Bengaluru", description: "", apply_url: "", source: "", posted_at: "", salary: "", employment_type: "", remote: null },
];

function authed() {
  localStorage.setItem("sjt_token", "t");
  get.mockImplementation((path: string) => {
    if (path === "/api/auth/me") return Promise.resolve({ user: USER });
    if (path === "/api/discover/searches") return Promise.resolve({ searches: [] });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function shell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DiscoverPage notify={notify} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
});

describe("Discover Jobs (native)", () => {
  it("searches, shows results with details, and saves", async () => {
    authed();
    post.mockResolvedValue({ search_id: "s1", jobs: JOBS, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }, meta: { cached: false } });
    shell();

    fireEvent.change(await screen.findByLabelText("Role or keywords"), { target: { value: "Python Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Search jobs" }));

    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(await screen.findByText("Hyderabad · FULL_TIME · Remote")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/discover/search", { role: "Python Developer", location: "Hyderabad", experience: "Fresher" });

    // Details expand inline with the apply link; no external navigation needed.
    fireEvent.click((await screen.findAllByText("View details"))[0]);
    expect(await screen.findByText("Apply →")).toBeTruthy();

    post.mockResolvedValue({ id: "app1" });
    fireEvent.click((await screen.findAllByRole("button", { name: "Save" }))[0]);
    expect(await screen.findByText("Saved ✓")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/discover/jobs/s1/abc123/save");
    expect(notify).toHaveBeenCalled();
  });

  it("links the existing application on duplicate save", async () => {
    authed();
    post.mockImplementation((path: string) => {
      if (path === "/api/discover/search")
        return Promise.resolve({ search_id: "s1", jobs: JOBS, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }, meta: { cached: true } });
      const conflict = Object.assign(new Error("Already tracked"), { code: "CONFLICT", details: { application_id: "existing-app" } });
      return Promise.reject(conflict);
    });
    shell();

    fireEvent.change(await screen.findByLabelText("Role or keywords"), { target: { value: "Python" } });
    fireEvent.click(screen.getByRole("button", { name: "Search jobs" }));
    expect(await screen.findByText("Acme")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Save" }))[0]);
    const link = await screen.findByRole("link", { name: "Saved. View application" });
    expect(link.getAttribute("href")).toBe("/applications/existing-app");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Already tracked"));
  });

  it("shows a clean error without internals when discovery is down", async () => {
    authed();
    post.mockRejectedValue(new Error("Job discovery is temporarily unavailable. Please try again."));
    shell();

    fireEvent.change(await screen.findByLabelText("Role or keywords"), { target: { value: "Python" } });
    fireEvent.click(screen.getByRole("button", { name: "Search jobs" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/temporarily unavailable/i);
    expect(alert.textContent).not.toContain("SERPAPI");
    expect(alert.textContent).not.toContain("localhost");
  });

  it("loads previous searches with pagination", async () => {
    authed();
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path === "/api/discover/searches")
        return Promise.resolve({ searches: [{ id: "s7", role: "Python", location: "Hyderabad", experience: "Fresher", job_count: 2, created_at: "2026-01-01" }] });
      if (path.startsWith("/api/discover/jobs?"))
        return Promise.resolve({ search_id: "s7", jobs: JOBS, pagination: { page: 1, limit: 1, total: 2, totalPages: 2 } });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    shell();

    fireEvent.change(await screen.findByLabelText("Previous searches"), { target: { value: "s7" } });
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(await screen.findByText("2 jobs · Page 1 of 2")).toBeTruthy();
  });
});
