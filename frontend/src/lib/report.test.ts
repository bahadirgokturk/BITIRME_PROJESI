import { describe, expect, it } from "vitest";

import { LOCATIONS } from "@/mocks/fixtures";

import { addFiles, descriptionProblem, fileProblem, REPORT_MAX_FILES, searchLocations } from "./report";

const MB = 1024 * 1024;

function file(type: string, sizeMb: number, name = "dosya"): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: sizeMb * MB });
  return f;
}

describe("descriptionProblem", () => {
  it.each(["", "   ", "sabun yok"])("asks for at least 10 characters for %j", (text) => {
    expect(descriptionProblem(text)).toBe("Açıklama en az 10 karakter olmalı.");
  });

  it("rejects a description longer than the backend allows", () => {
    expect(descriptionProblem("a".repeat(2001))).toBe("Açıklama en fazla 2000 karakter olabilir.");
  });

  it("accepts a normal description, ignoring surrounding spaces", () => {
    expect(descriptionProblem("  B blok tuvalette sabun bitmiş  ")).toBeNull();
  });
});

describe("fileProblem", () => {
  it.each([
    ["image/jpeg", 4],
    ["image/png", 1],
    ["image/webp", 5],
    ["video/mp4", 40],
    ["video/quicktime", 50],
  ])("accepts %s of %i MB", (type, size) => {
    expect(fileProblem(file(type, size))).toBeNull();
  });

  it("rejects other file types", () => {
    expect(fileProblem(file("application/pdf", 1))).toBe(
      "Yalnız JPG, PNG, WEBP fotoğraf ya da MP4, MOV video eklenebilir.",
    );
  });

  it("limits photos to 10 MB", () => {
    expect(fileProblem(file("image/png", 8))).toBeNull();
    expect(fileProblem(file("image/png", 11))).toBe("Fotoğraf en fazla 10 MB olabilir.");
  });

  it("limits videos to 50 MB", () => {
    expect(fileProblem(file("video/mp4", 51))).toBe("Video en fazla 50 MB olabilir.");
  });
});

describe("addFiles", () => {
  it("adds usable files and reports the first rejected one", () => {
    const photo = file("image/png", 1, "a.png");
    const pdf = file("application/pdf", 1, "b.pdf");

    const result = addFiles([], [photo, pdf]);

    expect(result.files).toEqual([photo]);
    expect(result.problem).toContain("Yalnız JPG");
  });

  it("keeps at most the allowed number of files", () => {
    const current = Array.from({ length: REPORT_MAX_FILES - 1 }, (_, i) => file("image/png", 1, `${i}.png`));

    const result = addFiles(current, [file("image/png", 1, "x.png"), file("image/png", 1, "y.png")]);

    expect(result.files).toHaveLength(REPORT_MAX_FILES);
    expect(result.problem).toBe("En fazla 5 dosya eklenebilir.");
  });
});

describe("searchLocations", () => {
  const names = (query: string) => searchLocations(LOCATIONS, query).map((location) => location.name);

  it("returns every location for an empty search", () => {
    expect(names("  ")).toHaveLength(LOCATIONS.length);
  });

  it("matches the name without caring about case or Turkish letters", () => {
    expect(names("KAMPUS")).toEqual(["Merkez Kampüs"]);
    expect(names("erkek wc")).toEqual(["B Blok 2. Kat Erkek WC"]);
  });

  it("matches nicknames and codes", () => {
    expect(names("b2 wc")).toEqual(["B Blok 2. Kat Erkek WC"]);
    expect(names("amfi")).toEqual(["B201 Amfi"]);
    expect(names("B-201")).toEqual(["B201 Amfi"]);
  });

  it("needs every word to match", () => {
    expect(names("amfi wc")).toEqual([]);
  });
});
