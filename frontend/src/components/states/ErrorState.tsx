import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

interface ErrorStateProps {
  title: string;
  error: Error;
  onRetry: () => void;
}

// Backend cevap verdiyse onun mesaji gosterilir (docs/UI_GUIDE.md bolum 6); cevap yoksa ag sorunudur
const NETWORK_HINT = "Bağlantınızı kontrol edip tekrar deneyin.";

export function ErrorState({ title, error, onRetry }: ErrorStateProps) {
  const detail = error instanceof ApiError ? error.message : NETWORK_HINT;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
      <Button variant="outline" className="mt-2 h-11 px-4" onClick={onRetry}>
        Tekrar dene
      </Button>
    </div>
  );
}
