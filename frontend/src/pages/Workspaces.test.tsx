import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { InterviewsPage } from "./Interviews";
import { ResumesPage } from "./Resumes";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const USER = { id: "u1", email: "a@b.com", name: "Al", role: "student", created_at: "2026-01-01" };
const notify = vi.fn();

function authed() {
  localStorage.setItem("sjt_token", "t");
  get.mockImplementation((path: string) => {
    if (path === "/api/auth/me") return Promise.resolve({ user: USER });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function shell(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Interviews workspace", () => {
  it("shows a guided empty state with no interviews", async () => {
    authed();
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      return Promise.resolve({ items: [] });
    });
    shell(<InterviewsPage notify={notify} />);
    expect(await screen.findByText("No interviews scheduled")).toBeTruthy();
    expect(await screen.findByText("Review applications")).toBeTruthy();
  });

  it("groups interviews into Today / This week", async () => {
    authed();
    const in2h = new Date(Date.now() + 2 * 3600000).toISOString();
    const in3d = new Date(Date.now() + 3 * 86400000).toISOString();
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      if (path.startsWith("/api/interviews"))
        return Promise.resolve({
          items: [
            { id: "i1", user_id: "u1", application_id: "a1", interview_type: "HR", scheduled_at: in2h, interviewer: "", meeting_url: "", notes: "", result: "", created_at: "", company: "Acme", job_title: "Dev" },
            { id: "i2", user_id: "u1", application_id: "a1", interview_type: "TECHNICAL", scheduled_at: in3d, interviewer: "", meeting_url: "", notes: "", result: "", created_at: "", company: "Beta", job_title: "Dev" },
          ],
        });
      return Promise.resolve({ items: [] });
    });
    shell(<InterviewsPage notify={notify} />);
    expect(await screen.findByText(/Today/)).toBeTruthy();
    expect(await screen.findByText("This week")).toBeTruthy();
    expect(await screen.findByText(/Acme/)).toBeTruthy();
  });
});

describe("Resumes workspace", () => {
  it("shows a guided empty state with no resumes", async () => {
    authed();
    get.mockImplementation((path: string) => {
      if (path === "/api/auth/me") return Promise.resolve({ user: USER });
      return Promise.resolve({ items: [] });
    });
    shell(<ResumesPage notify={notify} />);
    expect(await screen.findByText("No resumes yet")).toBeTruthy();
    expect(await screen.findByText("Upload resume")).toBeTruthy();
  });
});
