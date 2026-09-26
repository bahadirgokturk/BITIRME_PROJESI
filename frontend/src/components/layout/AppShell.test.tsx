import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the menu of the given role", () => {
    render(
      <AppShell role="STAFF">
        <p>içerik</p>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Ana menü" });
    expect(within(nav).getByRole("link", { name: "Görevlerim" })).toHaveAttribute(
      "href",
      "/staff/tasks",
    );
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByText("içerik")).toBeInTheDocument();
  });
});
