import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INSTALL_PROMPT_DISMISSED_KEY } from "@/lib/pwa";

import { InstallPrompt } from "./InstallPrompt";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";

function setUserAgent(value: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(value);
}

// Chrome'un "yuklenebilir" olayinin test karsiligi
function fireInstallable() {
  const event = new Event("beforeinstallprompt");
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

beforeEach(() => {
  window.localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstallPrompt", () => {
  it("installs with one tap when the browser offers it", async () => {
    render(<InstallPrompt hasCases />);
    const prompt = fireInstallable();

    await userEvent.setup().click(screen.getByRole("button", { name: "Yükle" }));

    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByText("BakırçayFlow’u ana ekranına ekle")).not.toBeInTheDocument();
  });

  it("shows the two iPhone steps and remembers 'Anladım'", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt hasCases />);

    expect(await screen.findByText("Alttaki Paylaş simgesine dokun")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Anladım" }));

    expect(screen.queryByText("Alttaki Paylaş simgesine dokun")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("does not ask again after 'Şimdi değil'", async () => {
    const { unmount } = render(<InstallPrompt hasCases />);
    fireInstallable();
    await userEvent.setup().click(screen.getByRole("button", { name: "Şimdi değil" }));
    unmount();

    render(<InstallPrompt hasCases />);
    fireInstallable();

    expect(screen.queryByRole("button", { name: "Yükle" })).not.toBeInTheDocument();
  });

  it("waits for the first case", () => {
    render(<InstallPrompt hasCases={false} />);
    fireInstallable();

    expect(screen.queryByRole("button", { name: "Yükle" })).not.toBeInTheDocument();
  });
});
