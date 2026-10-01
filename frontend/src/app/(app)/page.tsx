import { HomeRedirect } from "@/components/layout/HomeRedirect";
import { HealthStatus } from "@/components/system/HealthStatus";

export default function HomePage() {
  return (
    <HomeRedirect>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">CampusFlow AI</h1>
        <p className="text-muted-foreground">
          Kampüs olay, görev ve karar destek platformu — geliştirme ortamı.
        </p>
        <HealthStatus />
      </div>
    </HomeRedirect>
  );
}
