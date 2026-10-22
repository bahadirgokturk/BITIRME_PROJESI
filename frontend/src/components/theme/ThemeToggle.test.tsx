import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import { ThemeToggle } from "./ThemeToggle";

const root = () => document.documentElement;

afterEach(() => {
  root().classList.remove("dark");
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("shows the sun in light mode and switches the page to dark on click", async () => {
    const { container } = render(<ThemeToggle />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Koyu mod" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", "Koyu moda geç");
    expect(container.querySelector(".lucide-sun")).not.toBeNull();

    await user.click(button);

    expect(root()).toHaveClass("dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("title", "Açık moda geç");
    expect(container.querySelector(".lucide-moon-star")).not.toBeNull();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("goes back to light and remembers it", async () => {
    root().classList.add("dark");
    render(<ThemeToggle />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Koyu mod" }));

    expect(root()).not.toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  // Ayni sayfada iki dugme var (telefon cubugu ve masaustu menusu); ikisi de ayni temayi gosterir
  it("keeps every toggle on the page in step", async () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );
    const user = userEvent.setup();
    const [first, second] = screen.getAllByRole("button", { name: "Koyu mod" });

    await user.click(first!);

    expect(second).toHaveAttribute("aria-pressed", "true");
  });
});
