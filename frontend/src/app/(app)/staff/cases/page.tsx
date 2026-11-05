import { CaseList } from "@/components/manager/cases/CaseList";

// Personelin birim bildirimleri: backend kapsami kendi birimi ve kendisine atananlar
export default function StaffCasesPage() {
  return <CaseList view="unit" />;
}
