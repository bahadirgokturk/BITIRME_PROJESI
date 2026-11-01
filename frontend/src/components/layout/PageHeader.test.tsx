import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

// Yeni stil sayfa basi (Figma: 08 Yeni Stil (A)): baslik, hemen altinda aciklama, sagda islemler
describe("PageHeader", () => {
  it("shows the title, the description under it and the actions", () => {
    render(
      <PageHeader
        title="Raporlar"
        description="Seçilen dönemde kampüsteki bildirimler."
        actions={<button>Yazdır</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Raporlar" })).toBeInTheDocument();
    expect(screen.getByText("Seçilen dönemde kampüsteki bildirimler.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yazdır" })).toBeInTheDocument();
  });

  it("works without a description or actions", () => {
    render(<PageHeader title="Genel Bakış" />);

    expect(screen.getByRole("heading", { level: 1, name: "Genel Bakış" })).toBeInTheDocument();
  });
});
