import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeProvider } from "../hooks/useTheme";
import { ProfilePage } from "./Profile";
import { AdminPage } from "./Admin";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;
const del = api.del as unknown as ReturnType<typeof vi.fn>;
const notify = vi.fn();

const USERS = [
  { id: "u1", email: "a@b.com", name: "Al", role: "admin", created_at: "2026-01-01" },
  { id: "u2", email: "b@b.com", name: "Bo", role: "student", created_at: "2026-02-01" },
];

const DETAIL_U2 = {
  ...USERS[1],
  counts: { applications: 2, interviews: 1, notes: 0, resumes: 1, sessions: 1 },
};

function shell(ui: React.ReactElement, role = "student") {
  localStorage.setItem("sjt_token", "t");
  get.mockImplementation((path: string) => {
    if (path === "/api/auth/me")
      return Promise.resolve({ user: { id: "u1", email: "a@b.com", name: "Al", role, created_at: "2026-01-01" } });
    if (path.startsWith("/api/admin/users?"))
      return Promise.resolve({ items: USERS, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    if (path === "/api/admin/users/u2") return Promise.resolve(DETAIL_U2);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
});

describe("Profile page", () => {
  it("shows account, role/permissions, and security without sensitive data", async () => {
    shell(<ProfilePage />);
    expect(await screen.findByText("a@b.com")).toBeTruthy();
    expect(screen.getByText("student")).toBeTruthy();
    expect(screen.getByText(/Manage your own tracker data/)).toBeTruthy();
    expect(screen.getByText(/server on every request/)).toBeTruthy();
    // No password hash or token material anywhere.
    expect(document.body.innerHTML).not.toContain("password_hash");
    expect(document.body.innerHTML).not.toContain("sjt_token");
  });

  it("describes admin permissions for admins", async () => {
    shell(<ProfilePage />, "admin");
    expect(await screen.findByText("admin")).toBeTruthy();
    expect(screen.getByText(/Manage users and roles/)).toBeTruthy();
  });
});

describe("Admin page", () => {
  it("denies non-admins without calling the API", async () => {
    shell(<AdminPage notify={notify} />);
    expect(await screen.findByText("Admin access required")).toBeTruthy();
    expect(get).not.toHaveBeenCalledWith("/api/admin/users");
  });

  it("lists users and changes roles as admin", async () => {
    put.mockResolvedValue({ ok: true });
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();
    // Own row is not editable (server also rejects self-change).
    expect(screen.getByText("admin (you)")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Role for b@b.com"), { target: { value: "admin" } });
    expect(put).toHaveBeenCalledWith("/api/admin/users/u2/role", { role: "admin" });
    expect(await screen.findByText("admin (you)")).toBeTruthy();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("now admin"));
  });

  it("searches and filters through server query params", async () => {
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "b@b" } });
    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "student" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(get).toHaveBeenCalledWith(expect.stringContaining("search=b%40b"));
    expect(get).toHaveBeenCalledWith(expect.stringContaining("role=student"));
  });

  it("creates a user through the form", async () => {
    post.mockResolvedValue({ id: "u3", email: "c@c.com", name: "Cy", role: "student", created_at: "2026-03-01" });
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New user" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "c@c.com" } });
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "student" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("c@c.com")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/api/admin/users", { email: "c@c.com", password: "password123", name: "", role: "student" });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Created"));
  });

  it("shows validation errors from the server on create", async () => {
    post.mockRejectedValue(new Error("Email already registered"));
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New user" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "b@b.com" } });
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Email already registered")).toBeTruthy();
  });

  it("expands details with counts and edits the name", async () => {
    put.mockResolvedValue({ id: "u2", email: "b@b.com", name: "Bobby", role: "student", created_at: "2026-02-01" });
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.click(screen.getByText("Bo"));
    expect(await screen.findByText(/2 applications · 1 interviews/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bobby" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(put).toHaveBeenCalledWith("/api/admin/users/u2", { name: "Bobby" });
    expect(await screen.findByText("Bobby")).toBeTruthy();
  });

  it("confirms deletion with consequences before calling the API", async () => {
    del.mockResolvedValue({ ok: true });
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.click((await screen.findAllByRole("button", { name: "Delete" }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/permanently deletes b@b\.com/)).toBeTruthy();
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(del).toHaveBeenCalledWith("/api/admin/users/u2");
  });

  it("surfaces delete conflicts instead of failing silently", async () => {
    const conflict = Object.assign(new Error("Cannot delete the last administrator"), { status: 409 });
    del.mockRejectedValue(conflict);
    shell(<AdminPage notify={notify} />, "admin");
    expect(await screen.findByText("b@b.com")).toBeTruthy();

    fireEvent.click((await screen.findAllByRole("button", { name: "Delete" }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/permanently deletes b@b\.com/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Cannot delete the last administrator")).toBeTruthy();
    expect(del).toHaveBeenCalledWith("/api/admin/users/u2");
  });
});
