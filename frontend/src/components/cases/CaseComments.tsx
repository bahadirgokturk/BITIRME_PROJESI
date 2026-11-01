"use client";

import { cn } from "cn";

import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseComments } from "@/hooks/useComments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canComment, canWriteInternal, type CommentRead } from "@/lib/comments";
import { formatDateTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/shell";

import { CommentForm } from "./CommentForm";

type CommentsQuery = ReturnType<typeof useCaseComments>;

// Ic not gri kutuda ve "Ic not" etiketiyle durur: renk tek basina anlam tasimaz (docs/UI_GUIDE.md bolum 8)
function CommentItem({ comment }: { comment: CommentRead }) {
  return (
    <li className={cn("space-y-1", comment.is_internal && "rounded-lg bg-muted px-3 py-2.5")}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium">{comment.author_name}</span>
        <span className="text-xs text-muted-foreground">
          {ROLE_LABELS[comment.author_role]} ·{" "}
          <time dateTime={comment.created_at}>{formatDateTime(comment.created_at)}</time>
        </span>
        {comment.is_internal ? (
          <span className="rounded-md border bg-card px-2 py-0.5 text-xs font-medium">İç not</span>
        ) : null}
      </p>
      <p className="text-sm break-words whitespace-pre-line">{comment.body}</p>
    </li>
  );
}

function CommentList({ query }: { query: CommentsQuery }) {
  if (query.isPending) {
    return (
      <div aria-label="Yorumlar yükleniyor" aria-busy="true" className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState title="Yorumlar yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz yorum yok.</p>;
  }
  return (
    <ul aria-label="Yorumlar" className="space-y-4">
      {query.data.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </ul>
  );
}

// Bildirim yorumlari: bildiren, personel ve mudur ayni bolumu kullanir (Figma: 05 Manager > Yorumlar).
// Kim ne yazabilir kurallari lib/comments.ts'te; ic notlari backend role gore zaten ayiklar.
export function CaseComments({ caseId }: { caseId: number }) {
  const query = useCaseComments(caseId);
  const role = useCurrentUser().data?.role;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Yorumlar</h2>
      <div className="space-y-4 surface p-4">
        <CommentList query={query} />
        {role && canComment(role) && !query.isError ? (
          <CommentForm caseId={caseId} allowInternal={canWriteInternal(role)} />
        ) : null}
      </div>
    </section>
  );
}
