// Sahte kisisel bildirimler (zil): backend'de olay kaydindan uretilir (docs/API.md "Notifications")
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Notification = components["schemas"]["NotificationRead"];

const MINUTE_MS = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE_MS).toISOString();

function initial(): Notification[] {
  return [
    {
      id: 3,
      case_id: 104,
      event_type: "INFO_REQUESTED",
      case_title: "Amfide garip bir koku var",
      message: "Bildiriminiz için ek bilgi istendi.",
      created_at: ago(10),
      read_at: null,
    },
    {
      id: 2,
      case_id: 102,
      event_type: "WORK_STARTED",
      case_title: "Amfide projeksiyon çalışmıyor",
      message: "Görevli çalışmaya başladı.",
      created_at: ago(120),
      read_at: null,
    },
    {
      id: 1,
      case_id: 101,
      event_type: "CASE_CLOSED",
      case_title: "Tuvalette sabun bitmiş",
      message: "Bildiriminiz çözüldü; değerlendirmenizi bekliyoruz.",
      created_at: ago(1440),
      read_at: ago(1300),
    },
  ];
}

let notifications = initial();

// Testler her seferinde ayni listeyle baslar
export function resetNotifications(): void {
  notifications = initial();
}

const unread = () => notifications.filter((item) => item.read_at === null);

export const notificationHandlers = [
  http.get(apiUrl("/notifications/unread-count"), () => HttpResponse.json({ count: unread().length })),
  http.get(apiUrl("/notifications"), ({ request }) => {
    const items = new URL(request.url).searchParams.get("unread_only") === "true" ? unread() : notifications;
    return HttpResponse.json({ items, total: items.length, page: 1 });
  }),
  http.post(apiUrl("/notifications/read-all"), () => {
    notifications = notifications.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }));
    return new HttpResponse(null, { status: 204 });
  }),
  http.post<{ id: string }>(apiUrl("/notifications/:id/read"), ({ params }) => {
    const id = Number(params.id);
    notifications = notifications.map((item) =>
      item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
