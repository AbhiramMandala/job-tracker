import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { InterviewsPage } from "./Interviews";
import { ResumesPage } from "./Resumes";
import { DiscoverPage } from "./Discover";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const USER = { id: "u1", email: "a@b.com", name: "Al", created_at: "2026-01-01" };
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
    expect(await screen.findByText("Today")).toBeTruthy();
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

describe("Discover save interaction", () => {
  const SEARCHES = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ searches: [{ id: 3, role: "Java Developer", location: "Hyderabad", experience: "Fresher", job_count: 2, retrieved_at: null }] }),
  };
  const JOBS = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      jobs: [{ id: 9, company: "Acme", title: "Java Dev", location: "Hyderabad", apply_link: "", salary: "", posted: "", description_snippet: "", match_total: 70 }],
    }),
  };
  const EXPORT = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ company: "Acme", job_title: "Java Dev", status: "SAVED" }),
  };

  it("picks a search, lists jobs, and saves one as an application", async () => {
    authed();
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/api/searches")) return Promise.resolve(SEARCHES);
      if (String(url).includes("/tracker-export")) return Promise.resolve(EXPORT);
      return Promise.resolve(JOBS);
    });
    vi.stubGlobal("fetch", fetchMock);
    post.mockResolvedValue({ id: "app1" });
    shell(<DiscoverPage notify={notify} />);

    const picker = (await screen.findByLabelText("Recent JobSetu searches")) as HTMLSelectElement;
    expect(picker.options.length).toBe(2); // placeholder + one search
    fireEvent.change(picker, { target: { value: "3" } });

    expect(await screen.findByText("Java Dev")).toBeTruthy();
    fireEvent.click(await screen.findByText("Save as application"));
    expect(await screen.findByText("Saved ✓")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/applications", expect.objectContaining({ company: "Acme" }));
    expect(notify).toHaveBeenCalled();
  });
});
