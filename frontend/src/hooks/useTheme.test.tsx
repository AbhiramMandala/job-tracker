import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./useTheme";

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="toggle">
      current:{theme}
    </button>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("defaults to light and toggles to dark with persistence", () => {
    renderProbe();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("jt-theme")).toBe("dark");
    expect(screen.getByText("current:dark")).toBeTruthy();
  });

  it("restores the saved theme on load", () => {
    localStorage.setItem("jt-theme", "dark");
    renderProbe();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByText("current:dark")).toBeTruthy();
  });
});
