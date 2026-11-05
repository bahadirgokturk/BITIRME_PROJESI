import { describe, expect, it } from "vitest";

import type { components } from "@/lib/api/types";

import { filterUsers, toUserBody, userAssignment, userFormProblems, type UserForm } from "./admin";

type UserRead = components["schemas"]["UserRead"];

function user(fields: Partial<UserRead>): UserRead {
  return {
    id: 1,
    email: "ayse@example.edu.tr",
    full_name: "Ayşe Yılmaz",
    role: "REPORTER",
    reporter_kind: "STUDENT",
    department_id: null,
    is_active: true,
    last_login_at: null,
    created_at: "2026-09-01T08:00:00Z",
    ...fields,
  };
}

const USERS = [
  user({ id: 1 }),
  user({ id: 2, full_name: "İsmail Öz", email: "ismail@example.edu.tr", role: "STAFF", reporter_kind: null, department_id: 1 }),
  user({ id: 3, full_name: "Zeynep Kaya", email: "zeynep@example.edu.tr", role: "MANAGER", reporter_kind: null, department_id: 2, is_active: false }),
];

const names = (list: UserRead[]) => list.map((item) => item.full_name);

describe("filterUsers", () => {
  it("finds users by name or e-mail, ignoring case with Turkish letters", () => {
    expect(names(filterUsers(USERS, { search: "ismail", role: null, status: "all" }))).toEqual(["İsmail Öz"]);
    expect(names(filterUsers(USERS, { search: "ZEYNEP@", role: null, status: "all" }))).toEqual(["Zeynep Kaya"]);
  });

  it("filters by role and by active status", () => {
    expect(names(filterUsers(USERS, { search: "", role: "STAFF", status: "all" }))).toEqual(["İsmail Öz"]);
    expect(names(filterUsers(USERS, { search: "", role: null, status: "inactive" }))).toEqual(["Zeynep Kaya"]);
    expect(filterUsers(USERS, { search: "", role: null, status: "active" })).toHaveLength(2);
  });
});

describe("userAssignment", () => {
  const departments = [{ id: 1, name: "Destek Hizmetleri Şube Müdürlüğü" }];

  it("shows the reporter kind for reporters and the department for staff", () => {
    expect(userAssignment(USERS[0] as UserRead, departments)).toBe("Öğrenci");
    expect(userAssignment(USERS[1] as UserRead, departments)).toBe("Destek Hizmetleri Şube Müdürlüğü");
  });

  it("shows a dash when nothing applies", () => {
    expect(userAssignment(user({ role: "ADMIN", reporter_kind: null }), departments)).toBe("–");
  });
});

const form = (fields: Partial<UserForm>): UserForm => ({
  full_name: "Ali Çelik",
  email: "ali@example.edu.tr",
  role: "REPORTER",
  reporter_kind: "STUDENT",
  department_id: "",
  password: "guclu-parola",
  ...fields,
});

describe("userFormProblems", () => {
  it("accepts a complete reporter", () => {
    expect(userFormProblems(form({}), "create")).toEqual({});
  });

  it("asks for a reporter kind for reporters and a department for staff and managers (backend 422 rules)", () => {
    expect(userFormProblems(form({ reporter_kind: "" }), "create").reporter_kind).toBe("Kullanıcı türü seçmelisiniz.");
    expect(userFormProblems(form({ role: "STAFF", department_id: "" }), "create").department_id).toBe("Birim seçmelisiniz.");
    expect(userFormProblems(form({ role: "MANAGER", department_id: "" }), "create").department_id).toBe("Birim seçmelisiniz.");
  });

  it("requires a name, an e-mail and an 8 character password when creating", () => {
    const problems = userFormProblems(form({ full_name: " ", email: "ali", password: "kisa" }), "create");

    expect(problems).toEqual({
      full_name: "Ad soyad yazmalısınız.",
      email: "Geçerli bir e-posta yazmalısınız.",
      password: "Parola en az 8 karakter olmalı.",
    });
  });

  it("does not ask for a password when editing", () => {
    expect(userFormProblems(form({ password: "" }), "edit")).toEqual({});
  });
});

describe("toUserBody", () => {
  it("clears the fields that do not belong to the role", () => {
    expect(toUserBody(form({ role: "STAFF", reporter_kind: "STUDENT", department_id: "2" }))).toEqual({
      full_name: "Ali Çelik",
      email: "ali@example.edu.tr",
      role: "STAFF",
      reporter_kind: null,
      department_id: 2,
    });
    expect(toUserBody(form({ department_id: "2" })).department_id).toBeNull();
  });
});
