import { ManagerCaseDetail } from "@/components/manager/case-detail/ManagerCaseDetail";

// Next.js 16: params bir Promise (node_modules/next/dist/docs/.../dynamic-routes.md)
export default async function ManagerCaseDetailPage({ params }: PageProps<"/manager/cases/[id]">) {
  const { id } = await params;
  return <ManagerCaseDetail caseId={id} />;
}
