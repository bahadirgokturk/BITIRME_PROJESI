import { CaseDetail } from "@/components/cases/CaseDetail";

// Next.js 16: params bir Promise (node_modules/next/dist/docs/.../dynamic-routes.md)
export default async function CaseDetailPage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  return <CaseDetail caseId={id} />;
}
