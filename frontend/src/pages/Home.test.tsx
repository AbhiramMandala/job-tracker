import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { HomePage } from "./Home";
import type { Dashboard } from "../types";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;

const USER = { id: "u1", email: "admin@gmail.com", name: "Admin User", created_at: "2026-01-01" };

const DASH: Dashboard = {
  totals: { total: 4, applied: 0, interviewing: 0, offers: 1, rejected: 0, saved: 3 },
  byStatus: [
    { status: "OFFER", count: 1 },
    { status: "SAVED", count: 3 },
  ],
  upcomingInterviews: [],
  recentApplications: [
    { id: "a1", user_id: "u1", company: "Colaberry", job_title: "Python Backend developer", location: "", job_url: "", job_type: "FULL_TIME", salary: "", application_date: "2026-09-01", status: "SAVED", notes: "Imported from JobSetu (job #1).", contact_person: "", contact_email: "", follow_up_date: null, follow_up_reminder: 0, follow_up_notes: "", resume_id: null, created_at: "2026-09-01", updated_at: "2026-09-01" },
    { id: "a2", user_id: "u1", company: "Qloron", job_title: "Python Backend Developer", location: "", job_url: "", job_type: "FULL_TIME", salary: "", application_date: "2026-09-02", status: "OFFER", notes: "", contact_person: "", contact_email: "", follow_up_date: null, follow_up_reminder: 0, follow_up_notes: "", resume_id: null, created_at: "2026-09-02", updated_at: "2026-09-02" },
  ],
  overdueFollowUps: [],
  upcomingFollowUps: [],
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
});

function renderHome() {
  localStorage.setItem("sjt_token", "test-token");
  get.mockImplementation((path: string) => {
    if (path === "/api/auth/me") return Promise.resolve({ user: USER });
    if (path === "/api/dashboard") return Promise.resolve(DASH);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Home command center", () => {
  it("greets the user and exposes the four actions", async () => {
    renderHome();
    expect(await screen.findByText(/Good (morning|afternoon|evening), Admin/)).toBeTruthy();
    for (const label of ["Discover Jobs", "My Applications", "Interviews", "Resumes"]) {
      expect(await screen.findByText(new RegExp(label))).toBeTruthy();
    }
  });

  it("shows the pipeline with counts, not just totals", async () => {
    renderHome();
    const pipeline = await screen.findByLabelText("Your pipeline");
    expect(pipeline.textContent).toContain("Saved");
    expect(pipeline.textContent).toContain("Offer");
    expect(pipeline.textContent).toContain("3");
    expect(pipeline.textContent).toContain("1");
  });

  it("surfaces a next action and recent applications", async () => {
    renderHome();
    const next = await screen.findByLabelText("Next action");
    expect(next.textContent).toContain("Colaberry");
    expect(await screen.findByText("View all applications →")).toBeTruthy();
  });

  it("shows an empty state with a discover CTA when there is nothing", async () => {
    localStorage.setItem("sjt_token", "test-token");
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      return Promise.resolve({
        totals: { total: 0, applied: 0, interviewing: 0, offers: 0, rejected: 0, saved: 0 },
        byStatus: [],
        upcomingInterviews: [],
        recentApplications: [],
        overdueFollowUps: [],
        upcomingFollowUps: [],
      });
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <HomePage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Find jobs")).toBeTruthy();
  });
});
