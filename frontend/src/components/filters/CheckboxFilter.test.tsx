import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CheckboxFilter } from "./CheckboxFilter";

const OPTIONS = [
  { value: "1", label: "Destek Hizmetleri" },
  { value: "2", label: "Bakım Onarım" },
];

function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <CheckboxFilter label="Birimler" summary={`Birimler: ${selected.join(",") || "Tümü"}`} options={OPTIONS} selected={selected} onChange={setSelected} />
      <p>sonuç {selected.join(",")}</p>
    </>
  );
}

describe("CheckboxFilter", () => {
  it("opens a list of ticks and narrows the choice", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Birimler: Tümü" });

    await user.click(trigger);
    await user.click(await screen.findByRole("checkbox", { name: "Bakım Onarım" }));

    expect(screen.getByRole("checkbox", { name: "Bakım Onarım" })).toBeChecked();
    expect(screen.getByText("sonuç 2")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Destek Hizmetleri" }));

    expect(screen.getByText("sonuç 2,1")).toBeInTheDocument();
  });

  it("clears the choice in one step", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Birimler/ }));
    await user.click(await screen.findByRole("checkbox", { name: "Bakım Onarım" }));

    await user.click(screen.getByRole("button", { name: "Seçimi temizle" }));

    expect(screen.getByRole("checkbox", { name: "Bakım Onarım" })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Seçimi temizle" })).not.toBeInTheDocument();
  });
});
