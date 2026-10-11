import { AuditLogsScreen } from "@/components/admin/audit-logs/AuditLogsScreen";
import { parseAuditTarget } from "@/lib/auditLogs";

// Next.js 16: searchParams bir Promise (node_modules/next/dist/docs/.../layouts-and-pages.md).
// ?entity_type=CASE_TYPE&entity_id=12 tek bir kaydin gecmisini acar; key suzgec degisince ekrani sifirlar.
export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const target = parseAuditTarget(await searchParams);
  return <AuditLogsScreen key={target ? `${target.entityType}-${target.entityId}` : "all"} target={target} />;
}
