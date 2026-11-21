import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/queryClient";
import { MOCK_PASSWORD } from "@/mocks/fixtures";

import { ChangePasswordButton } from "./ChangePasswordButton";

async function openDialog() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ChangePasswordButton size="desktop" />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }));
  return { user, dialog: await screen.findByRole("dialog", { name: "Parolayı değiştir" }) };
}

async function fill(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, current: string, next: string) {
  await user.type(within(dialog).getByLabelText("Mevcut parola"), current);
  await user.type(within(dialog).getByLabelText("Yeni parola"), next);
  await user.type(within(dialog).getByLabelText("Yeni parola (tekrar)"), next);
  await user.click(within(dialog).getByRole("button", { name: "Parolayı kaydet" }));
}

describe("ChangePasswordButton", () => {
  it("changes the password and says other devices were signed out", async () => {
    const { user, dialog } = await openDialog();

    await fill(user, dialog, MOCK_PASSWORD, "yeni-parola-1");

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Parolan değiştirildi. Diğer cihazlardaki oturumların kapatıldı.",
    );
  });

  // Yanlis mevcut parola oturumu kapatmaz (backend 422); mesaj formun icinde kalir
  it("shows the backend message when the current password is wrong", async () => {
    const { user, dialog } = await openDialog();

    await fill(user, dialog, "yanlis-parola", "yeni-parola-1");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Mevcut parola hatalı.");
  });

  it("checks the repeat before sending", async () => {
    const { user, dialog } = await openDialog();

    await user.type(within(dialog).getByLabelText("Mevcut parola"), MOCK_PASSWORD);
    await user.type(within(dialog).getByLabelText("Yeni parola"), "yeni-parola-1");
    await user.type(within(dialog).getByLabelText("Yeni parola (tekrar)"), "yeni-parola-2");
    await user.click(within(dialog).getByRole("button", { name: "Parolayı kaydet" }));

    expect(within(dialog).getByText("Yeni parolalar aynı değil.")).toBeInTheDocument();
  });
});
