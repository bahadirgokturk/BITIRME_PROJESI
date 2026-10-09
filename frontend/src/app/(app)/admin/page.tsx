import { redirect } from "next/navigation";

import { ADMIN_SECTIONS } from "@/lib/navigation";

// Menudeki "Yonetim" ilk bolume acilir (bugun yalniz Kullanicilar)
export default function AdminPage() {
  redirect(ADMIN_SECTIONS[0]?.href ?? "/");
}
