import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "@/lib/api/client";
import { saveXlsx } from "@/lib/exportFile";
import { createQueryClient } from "@/lib/queryClient";
import { resetAdminUsers } from "@/mocks/adminHandlers";
import { USERS } from "@/mocks/fixtures";
import { server } from "@/mocks/node";
import { signInAs } from "@/mocks/session";

import { UsersScreen } from "./UsersScreen";

vi.mock("@/lib/exportFile", async (original) => ({
  ...(await original<typeof import("@/lib/exportFile")>()),
  saveXlsx: vi.fn(),
}));

// Son "Excel'e aktar" ile kaydedilen tablo ve dosya adi
async function exportSheet(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(saveXlsx).mockClear();
  await user.click(await screen.findByRole("button", { name: "Excel'e aktar" }));
  await waitFor(() => expect(saveXlsx).toHaveBeenCalled());
  const [sheet, fileName] = vi.mocked(saveXlsx).mock.calls[0] ?? [];
  return { sheet: sheet!, fileName: fileName! };
}

function renderScreen() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <UsersScreen />
    </QueryClientProvider>,
  );
  return user;
}

const row = (name: string | RegExp) => screen.findByRole("row", { name });

// Sahte kullanici listesi modul icinde tutulur; her test ayni listeyle baslasin
beforeEach(() => resetAdminUsers());

describe("UsersScreen", () => {
  it("shows a skeleton while users load", () => {
    renderScreen();

    expect(screen.getByLabelText("Kullanıcılar yükleniyor")).toBeInTheDocument();
  });

  it("lists users with their role, department or reporter kind and status", async () => {
    renderScreen();

    const staff = await row(/Mehmet Demir/);
    expect(within(staff).getByText("Personel")).toBeInTheDocument();
    expect(await within(staff).findByText("Destek Hizmetleri Şube Müdürlüğü")).toBeInTheDocument();
    expect(within(await row(/Ayşe Yılmaz/)).getByText("Öğrenci")).toBeInTheDocument();
    expect(within(await row(/Ali Çelik/)).getByText("Pasif")).toBeInTheDocument();
    expect(screen.getByText("5 kullanıcı").closest("[data-slot=admin-table]")).not.toBeNull();
  });

  it("filters the table by search text and role", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.type(screen.getByLabelText("Kullanıcı ara"), "zeynep");
    await waitFor(() => expect(screen.queryByRole("row", { name: /Mehmet Demir/ })).not.toBeInTheDocument());
    expect(screen.getByRole("row", { name: /Zeynep Kaya/ })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Kullanıcı ara"));
    await user.selectOptions(screen.getByLabelText("Rol"), "Personel");
    await waitFor(() => expect(screen.queryByRole("row", { name: /Zeynep Kaya/ })).not.toBeInTheDocument());
  });

  it("offers to clear the filters when nothing matches", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.type(screen.getByLabelText("Kullanıcı ara"), "olmayan biri");
    expect(await screen.findByText("Aramanıza uyan kullanıcı yok.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtreleri temizle" }));

    expect(screen.getByLabelText("Kullanıcı ara")).toHaveValue("");
    expect(await row(/Mehmet Demir/)).toBeInTheDocument();
  });

  // Arama ve suzgecler sunucuya gider (GET /admin/users?q=&role=&department_id=&is_active=)
  it("sends the search and filters to the server", async () => {
    const searches: string[] = [];
    const listen = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/admin/users")) {
        searches.push(url.search);
      }
    };
    server.events.on("request:start", listen);
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.selectOptions(screen.getByLabelText("Birim"), "Destek Hizmetleri Şube Müdürlüğü");
    await user.selectOptions(screen.getByLabelText("Durum"), "Pasif");
    await user.type(screen.getByLabelText("Kullanıcı ara"), "ali");

    await waitFor(() => expect(searches.at(-1)).toMatch(/q=ali&department_id=\d+&is_active=false/));
    await waitFor(() => expect(screen.queryByRole("row", { name: /Mehmet Demir/ })).not.toBeInTheDocument());
    server.events.removeListener("request:start", listen);
  });

  // 50'den fazla kullanici sayfa sayfa okunur; toplam sunucunun suzulmus sayisidir
  it("pages through more users than fit on one page", async () => {
    server.use(
      http.get(apiUrl("/admin/users"), ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
        const items = [{ ...USERS.STAFF, id: 100 + page, full_name: `Sayfa ${page} Kişisi` }];
        return HttpResponse.json({ items, total: 120, page });
      }),
    );
    const user = renderScreen();
    await row(/Sayfa 1 Kişisi/);
    expect(screen.getByText("1–50 / 120 kullanıcı")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sonraki" }));

    expect(await row(/Sayfa 2 Kişisi/)).toBeInTheDocument();
    expect(screen.getByText("51–100 / 120 kullanıcı")).toBeInTheDocument();
  });

  it("labels each value for the phone card layout", async () => {
    renderScreen();

    const staff = await row(/Mehmet Demir/);
    expect(within(staff).getByText("Personel").closest("td")).toHaveAttribute("data-label", "Rol");
  });

  it("adds a reporter", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Elif Arslan");
    await user.type(within(sheet).getByLabelText("E-posta"), "elif@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Rol"), "Bildirim yapan");
    await user.selectOptions(within(sheet).getByLabelText("Kullanıcı türü"), "Akademik personel");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await row(/Elif Arslan/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Elif Arslan eklendi.");
  });

  it("explains a missing department before sending (staff needs one)", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Can Yurt");
    await user.type(within(sheet).getByLabelText("E-posta"), "can@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Rol"), "Personel");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByText("Birim seçmelisiniz.")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Can Yurt/ })).not.toBeInTheDocument();
  });

  it("edits a user's name", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Mehmet Demir/)).getByRole("button", { name: "Mehmet Demir kullanıcısını düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcıyı düzenle" });
    const name = within(sheet).getByLabelText("Ad soyad");
    await user.clear(name);
    await user.type(name, "Mehmet Demirci");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await row(/Mehmet Demirci/)).toBeInTheDocument();
  });

  it("deactivates a user from the edit panel", async () => {
    const user = renderScreen();

    await user.click(within(await row(/Mehmet Demir/)).getByRole("button", { name: "Mehmet Demir kullanıcısını düzenle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcıyı düzenle" });
    await user.click(within(sheet).getByRole("button", { name: "Pasifleştir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(await row(/Mehmet Demir/)).getByText("Pasif")).toBeInTheDocument();
  });

  it("keeps the panel open and shows the backend message for a duplicate e-mail", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);

    await user.click(screen.getByRole("button", { name: "Kullanıcı ekle" }));
    const sheet = await screen.findByRole("dialog", { name: "Kullanıcı ekle" });
    await user.type(within(sheet).getByLabelText("Ad soyad"), "Ayşe Yılmaz");
    await user.type(within(sheet).getByLabelText("E-posta"), "ayse.ogrenci@example.edu.tr");
    await user.selectOptions(within(sheet).getByLabelText("Kullanıcı türü"), "Öğrenci");
    await user.type(within(sheet).getByLabelText("Parola"), "guclu-parola");
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Bu e-posta adresi zaten kayıtlı.");
  });

  it("shows an error with retry when users cannot be loaded", async () => {
    server.use(
      http.get(
        apiUrl("/admin/users"),
        () => HttpResponse.json({ error: { code: "INTERNAL", message: "Beklenmeyen bir hata oluştu.", details: {} } }, { status: 500 }),
        { once: true },
      ),
    );
    const user = renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Kullanıcılar yüklenemedi.");
    await user.click(within(alert).getByRole("button", { name: "Tekrar dene" }));

    expect(await row(/Mehmet Demir/)).toBeInTheDocument();
  });
});

describe("UsersScreen export", () => {
  beforeEach(() => resetAdminUsers());

  // Aktarim ekranda gorunen (suzulmus) satirlari yazar
  it("exports the filtered users to Excel", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);
    await user.type(screen.getByLabelText("Kullanıcı ara"), "zeynep");

    const { sheet, fileName } = await exportSheet(user);

    expect(fileName).toMatch(/^kullanicilar-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(sheet.columns).toEqual(["Ad soyad", "E-posta", "Rol", "Birim / tür", "Son giriş", "Durum"]);
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]?.slice(0, 4)).toEqual([
      "Zeynep Kaya",
      "zeynep.mudur@example.edu.tr",
      "Birim müdürü",
      "Destek Hizmetleri Şube Müdürlüğü",
    ]);
  });
});

// Unutulan parola: yonetici gecici parola verir; kullanici ilk giriste kendi parolasini belirler (docs/API.md)
describe("UsersScreen password reset", () => {
  beforeEach(() => {
    resetAdminUsers();
    signInAs(USERS.ADMIN);
  });
  afterEach(() => signInAs(null));

  async function openEdit(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole("button", { name: `${name} kullanıcısını düzenle` }));
    return screen.findByRole("dialog");
  }

  it("gives a user a temporary password", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Mehmet Demir");

    await user.type(within(sheet).getByLabelText("Geçici parola"), "gecici-parola-1");
    await user.click(within(sheet).getByRole("button", { name: "Parolayı sıfırla" }));

    expect(await within(sheet).findByText(/Mehmet Demir için geçici parola verildi/)).toBeInTheDocument();
  });

  it("checks the temporary password before sending", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Mehmet Demir");

    await user.type(within(sheet).getByLabelText("Geçici parola"), "kisa");
    await user.click(within(sheet).getByRole("button", { name: "Parolayı sıfırla" }));

    expect(within(sheet).getByText("Geçici parola en az 8 karakter olmalı.")).toBeInTheDocument();
  });

  // Backend kendi hesabini sifirlamaya izin vermez (409 SELF_LOCKOUT): form hic gosterilmez
  it("sends the admin to the account menu for their own password", async () => {
    const user = renderScreen();
    const sheet = await openEdit(user, "Sistem Yöneticisi");

    expect(within(sheet).queryByLabelText("Geçici parola")).not.toBeInTheDocument();
    expect(within(sheet).getByText(/Kendi parolanı .*Parolayı değiştir/)).toBeInTheDocument();
  });
});

// Toplu yukleme: once dry_run ile denenir; hepsi ya da hicbiri (docs/API.md "Toplu yukleme").
// jsdom'da secilen dosyanin icerigi sahte API'ye ulasmaz; backend'in cevabini her test kendisi verir.
describe("UsersScreen bulk import", () => {
  beforeEach(() => resetAdminUsers());

  const CSV = "email,full_name,role,reporter_kind,department_code\nelif@example.edu.tr,Elif Arslan,REPORTER,STUDENT,\n";

  // Her istegin dry_run degeri kaydedilir; cevap sirayla verilir
  function answerImport(...results: { created: number; errors: { row: number; message: string }[] }[]) {
    const dryRuns: string[] = [];
    server.use(
      http.post(apiUrl("/admin/users/import"), ({ request }) => {
        const dryRun = new URL(request.url).searchParams.get("dry_run") ?? "";
        const result = results[dryRuns.length] ?? results.at(-1)!;
        dryRuns.push(dryRun);
        return HttpResponse.json({ ...result, dry_run: dryRun === "true" });
      }),
    );
    return dryRuns;
  }

  async function openImport(user: ReturnType<typeof userEvent.setup>, password = "gecici-parola") {
    await row(/Mehmet Demir/);
    await user.click(screen.getByRole("button", { name: "Toplu yükle (CSV)" }));
    const dialog = await screen.findByRole("dialog", { name: "Toplu yükle (CSV)" });
    const file = new File([CSV], "liste.csv", { type: "text/csv" });
    await user.upload(within(dialog).getByLabelText("CSV dosyası"), file);
    await user.type(within(dialog).getByLabelText("Ortak geçici parola"), password);
    return dialog;
  }

  it("offers the sample file", async () => {
    const user = renderScreen();
    await row(/Mehmet Demir/);
    await user.click(screen.getByRole("button", { name: "Toplu yükle (CSV)" }));

    const link = await screen.findByRole("link", { name: "Örnek dosyayı indir" });
    expect(link).toHaveAttribute("href", "/templates/kullanici-yukleme-ornek.csv");
  });

  it("checks the file first, then adds everyone", async () => {
    const dryRuns = answerImport({ created: 2, errors: [] });
    const user = renderScreen();
    const dialog = await openImport(user);

    await user.click(within(dialog).getByRole("button", { name: "Dosyayı kontrol et" }));
    expect(await within(dialog).findByText("Dosyada hata yok: 2 kullanıcı eklenecek.")).toBeInTheDocument();
    expect(dryRuns).toEqual(["true"]);

    await user.click(within(dialog).getByRole("button", { name: "2 kullanıcıyı ekle" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dryRuns).toEqual(["true", "false"]);
    expect(screen.getByRole("status")).toHaveTextContent("2 kullanıcı eklendi.");
  });

  it("lists the wrong rows with their Excel row number and adds nobody", async () => {
    const dryRuns = answerImport({ created: 0, errors: [{ row: 3, message: "Geçersiz e-posta adresi." }] });
    const user = renderScreen();
    const dialog = await openImport(user);

    await user.click(within(dialog).getByRole("button", { name: "Dosyayı kontrol et" }));

    const table = await within(dialog).findByRole("table", { name: "Hatalı satırlar" });
    expect(within(table).getByRole("row", { name: /3.*Geçersiz e-posta/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Hiçbir kullanıcı eklenmedi/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /kullanıcıyı ekle/ })).not.toBeInTheDocument();
    expect(dryRuns).toEqual(["true"]);
  });

  it("checks the password before sending", async () => {
    const dryRuns = answerImport({ created: 1, errors: [] });
    const user = renderScreen();
    const dialog = await openImport(user, "kisa");

    await user.click(within(dialog).getByRole("button", { name: "Dosyayı kontrol et" }));

    expect(within(dialog).getByText("Geçici parola en az 8 karakter olmalı.")).toBeInTheDocument();
    expect(dryRuns).toEqual([]);
  });

  it("shows the backend message when the file is refused", async () => {
    const refused = { error: { code: "INVALID_IMPORT_FILE", message: "Dosya okunamadı.", details: {} } };
    server.use(
      http.post(apiUrl("/admin/users/import"), () => HttpResponse.json(refused, { status: 422 }), { once: true }),
    );
    const user = renderScreen();
    const dialog = await openImport(user);

    await user.click(within(dialog).getByRole("button", { name: "Dosyayı kontrol et" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Dosya okunamadı.");
  });
});
