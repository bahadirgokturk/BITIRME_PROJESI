import { TaskDetail } from "@/components/tasks/TaskDetail";

// Next.js 16: params bir Promise (node_modules/next/dist/docs/.../dynamic-routes.md)
export default async function StaffTaskDetailPage({ params }: PageProps<"/staff/tasks/[id]">) {
  const { id } = await params;
  return <TaskDetail taskId={id} />;
}
