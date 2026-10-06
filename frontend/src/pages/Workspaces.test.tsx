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

describe("Discover embedded search", () => {
  const SEARCH_OK = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      search_id: 7,
      role: "Python Developer",
      is_live: true,
      jobs: [
        { id: 9, company: "Acme", title: "Python Dev", location: "Hyderabad", apply_link: "https://example.com/a", salary: "", posted: "", description_snippet: "Build APIs.", match_total: 70, signals: { experience: "entry", min_years: 0, job_type: "full-time" }, evidence_url: "/jobs/9/evidence", match: { total: 70, matched_skills: ["Python"], missing_skills: ["Django"], reasons: ["2/2 detected skills match"] } },
        { id: 10, company: "Beta", title: "Senior Python Dev", location: "Hyderabad", apply_link: "", salary: "", posted: "", description_snippet: "Lead the team.", match_total: 20, signals: { experience: "experienced", min_years: 5, job_type: "" }, evidence_url: "/jobs/10/evidence" },
      ],
    }),
  };
  const EXPORT = {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ company: "Acme", job_title: "Python Dev", status: "SAVED" }),
  };

  function mockJobSetu() {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes("/api/searches")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ searches: [] }) });
      if (String(url).includes("/tracker-export")) return Promise.resolve(EXPORT);
      if (String(url).endsWith("/api/search") && init?.method === "POST") return Promise.resolve(SEARCH_OK);
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("searches natively, shows signals, and saves without extra login", async () => {
    authed();
    mockJobSetu();
    post.mockResolvedValue({ id: "app1" });
    shell(<DiscoverPage notify={notify} />);

    fireEvent.change(await screen.findByLabelText("Role"), { target: { value: "Python Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Search jobs" }));

    // Cards render with company/role/location/signal chips and match context.
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(await screen.findByText("Hyderabad · Entry-level · Full-time")).toBeTruthy();
    expect(await screen.findByText(/70% match/)).toBeTruthy();

    // Embedded filters narrow the list without new requests.
    fireEvent.change(screen.getByLabelText("Filter by experience"), { target: { value: "experienced" } });
    expect(screen.queryByText("Acme")).toBeNull();
    expect(await screen.findByText("Beta")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter by experience"), { target: { value: "" } });
    expect(await screen.findByText("Acme")).toBeTruthy();

    // Details expand inline with evidence + apply links; save uses the session.
    fireEvent.click((await screen.findAllByText("View details"))[0]);
    expect(await screen.findByText("Why verified? Evidence →")).toBeTruthy();
    fireEvent.click((await screen.findAllByRole("button", { name: "Save" }))[0]);
    expect(await screen.findByText("Saved ✓")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/applications", expect.objectContaining({ company: "Acme" }));
    expect(notify).toHaveBeenCalled();
    expect(await screen.findByRole("link", { name: "Saved. View application" })).toBeTruthy();
  });
});
