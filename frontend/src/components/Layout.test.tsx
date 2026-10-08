import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AuthProvider } from "../hooks/useAuth";
import { ThemeProvider } from "../hooks/useTheme";
import { Layout } from "./Layout";

vi.mock("../services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), upload: vi.fn() },
  downloadResume: vi.fn(),
}));

import { api } from "../services/api";

const get = api.get as unknown as ReturnType<typeof vi.fn>;

function shell(role = "student") {
  localStorage.setItem("sjt_token", "t");
  get.mockImplementation((path: string) => {
    if (path === "/api/auth/me")
      return Promise.resolve({ user: { id: "u1", email: "a@b.com", name: "Al", role, created_at: "2026-01-01" } });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <Layout>
            <p>Page content</p>
          </Layout>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  document.body.style.overflow = "";
});

describe("navigation drawer", () => {
  it("shows a hamburger on all breakpoints and no permanent sidebar", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();
    // Hamburger is always rendered (no md:hidden gate).
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    expect(toggle.className).not.toContain("md:hidden");
    // Drawer starts translated off-canvas.
    expect(screen.getByRole("dialog", { name: "Site navigation" }).className).toContain("-translate-x-full");
  });

  it("renders an auth-coherent footer (no Sign in next to Logout)", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeTruthy();
    expect(within(footer).getByRole("link", { name: "Applications" })).toBeTruthy();
    expect(within(footer).getByRole("link", { name: "Profile" })).toBeTruthy();
    expect(within(footer).queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(within(footer).queryByRole("link", { name: "Sign up" })).toBeNull();
    expect(screen.getByText(/© \d{4} JobTracker/)).toBeTruthy();
  });

  it("opens the drawer with backdrop+blur and closes on backdrop click", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const backdrop = await screen.findByTestId("nav-backdrop");
    expect(backdrop.className).toContain("backdrop-blur");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(backdrop);
    expect(screen.queryByTestId("nav-backdrop")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the drawer on Escape and on navigation", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByTestId("nav-backdrop")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("nav-backdrop")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByTestId("nav-backdrop")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Site navigation" })).getByRole("link", { name: "Applications" }));
    expect(screen.queryByTestId("nav-backdrop")).toBeNull();
  });

  it("navigates to the profile from the avatar", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();
    const avatar = screen.getByRole("link", { name: "Open your profile" });
    expect(avatar.getAttribute("href")).toBe("/profile");
  });

  it("logs out from inside the drawer", async () => {
    shell();
    expect(await screen.findByText("Page content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = await screen.findByRole("dialog", { name: "Site navigation" });
    const post = (await import("../services/api")).api.post as unknown as ReturnType<typeof vi.fn>;
    post.mockResolvedValue({ ok: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Logout" }));
    expect(post).toHaveBeenCalledWith("/api/auth/logout");
    await vi.waitFor(() => expect(localStorage.getItem("sjt_token")).toBeNull());
  });

  it("shows the Admin nav item only for admins", async () => {
    shell("student");
    expect(await screen.findByText("Page content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = await screen.findByRole("dialog", { name: "Site navigation" });
    expect(within(dialog).queryByRole("link", { name: "Admin" })).toBeNull();
    cleanup();

    shell("admin");
    expect(await screen.findByText("Page content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const adminDialog = await screen.findByRole("dialog", { name: "Site navigation" });
    expect(within(adminDialog).getByRole("link", { name: "Admin" })).toBeTruthy();
  });
});
