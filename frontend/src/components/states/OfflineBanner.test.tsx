import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "./OfflineBanner";

const MESSAGE = "İnternet bağlantınız yok. Bağlanınca sayfa yenilenir.";

function goOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineBanner", () => {
  it("stays empty while the device is online", () => {
    render(<OfflineBanner />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("tells the user when the connection drops and hides when it returns", () => {
    render(<OfflineBanner />);

    goOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent(MESSAGE);

    goOnline(true);
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });
});
