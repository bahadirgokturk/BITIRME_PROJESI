import { DepartmentDetail } from "@/components/manager/departments/DepartmentDetail";
import { periodFromParam } from "@/lib/departments";

// Next.js 16: params ve searchParams birer Promise (node_modules/next/dist/docs/.../dynamic-routes.md)
export default async function DepartmentDetailPage({ params, searchParams }: PageProps<"/manager/departments/[id]">) {
  const { id } = await params;
  const { period } = await searchParams;
  return <DepartmentDetail departmentId={id} initialPeriod={periodFromParam(period)} />;
}
