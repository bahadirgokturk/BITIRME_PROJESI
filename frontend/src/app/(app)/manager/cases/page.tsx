import { CaseList } from "@/components/manager/cases/CaseList";
import { groupFromParam } from "@/lib/caseList";

// Pano kartlari listeyi filtreli acar (?group=open); searchParams Next.js 16'da Promise
export default async function ManagerCasesPage({ searchParams }: PageProps<"/manager/cases">) {
  const { group } = await searchParams;
  return <CaseList initialGroup={groupFromParam(group)} />;
}
