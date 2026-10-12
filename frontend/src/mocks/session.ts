// Sahte oturum: kim giris yapmis? Giris yapilmadiysa NEXT_PUBLIC_MOCK_ROLE rolundeki fixture kullanicisi.
// Ayri dosyada durur ki rol kurali olan sahte endpoint'ler (yorumlar) de kullanabilsin.
import type { components } from "@/lib/api/types";

import { USERS, type Role } from "./fixtures";

type User = components["schemas"]["UserRead"];

function mockRole(): Role {
  const role = process.env.NEXT_PUBLIC_MOCK_ROLE as Role | undefined;
  return role && role in USERS ? role : "REPORTER";
}

// Sayfa yenilenince sifirlanir ve NEXT_PUBLIC_MOCK_ROLE'e donulur. Boylece her rol, sunucuyu yeniden
// baslatmadan o rolun e-postasiyla giris yaparak denenebilir (e2e/).
let signedIn: User | null = null;

export function currentUser(): User {
  return signedIn ?? USERS[mockRole()];
}

// null: cikis (testler de rol degistirmek icin kullanir)
export function signInAs(user: User | null): void {
  signedIn = user;
}
