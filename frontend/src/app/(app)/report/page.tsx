import { ReportScreen } from "@/components/report/ReportScreen";

// Kapidaki QR formu konum secili acar (?location=<id>); searchParams Next.js 16'da Promise
export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { location } = await searchParams;
  return <ReportScreen qrLocation={typeof location === "string" ? location : undefined} />;
}
