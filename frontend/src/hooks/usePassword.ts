import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminUser } from "@/hooks/useAdminUsers";
import { apiPost } from "@/lib/api/client";
import { changePassword } from "@/lib/api/session";

// Kendi parolasi: basarida kullanici bilgisi yeniden okunur ("ilk giriste degistir" bayragi kalkar)
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => changePassword(current, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
  });
}

// Yoneticinin verdigi gecici parola; kullanicinin acik oturumlari backend'de kapanir
export function useResetUserPassword(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiPost<AdminUser>(`/admin/users/${userId}/password`, { new_password: password }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
