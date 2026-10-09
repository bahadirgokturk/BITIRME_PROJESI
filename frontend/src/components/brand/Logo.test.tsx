import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoWordmark } from "./Logo";

describe("LogoWordmark", () => {
  it("writes the product name next to the mark", () => {
    render(<LogoWordmark />);

    expect(screen.getByText("Bakırçay")).toHaveTextContent("BakırçayFlow");
  });
});
