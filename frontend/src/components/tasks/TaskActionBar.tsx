"use client";

import { FormAlert } from "@/components/states/FormAlert";
import { Button } from "@/components/ui/button";
import { useAcceptTask, useCompleteTask, useDeclineTask, useStartTask } from "@/hooks/useTasks";
import { taskActions, type TaskRead } from "@/lib/tasks";

import { TaskNoteDialog, type TaskNoteCopy } from "./TaskNoteDialog";

// Ana eylem tek ve buyuk (48 px), reddetme ikincil (44 px) (docs/UI_GUIDE.md bolum 5.3)
const PRIMARY_CLASS = "h-12 w-full";
const SECONDARY_CLASS = "h-11 w-full";

const COMPLETE_COPY: TaskNoteCopy = {
  title: "Görevi tamamla",
  description: "Bildirim çözüldü olarak işaretlenir ve bildiren kişiye haber verilir.",
  label: "Not (isteğe bağlı)",
  placeholder: "Ne yaptığını kısaca yaz…",
  submit: "Tamamla",
  submitting: "Tamamlanıyor…",
};

const DECLINE_COPY: TaskNoteCopy = {
  title: "Görevi reddet",
  description: "Görev birim müdürüne geri gider. Neden yapamayacağını kısaca yaz.",
  label: "Reddetme nedeni",
  placeholder: "Örn. Bu iş teknik ekibin alanına giriyor.",
  submit: "Reddet",
  submitting: "Reddediliyor…",
};

function CompleteAction({ task }: { task: TaskRead }) {
  const complete = useCompleteTask(task);
  return (
    <TaskNoteDialog
      copy={COMPLETE_COPY}
      trigger={<Button className={PRIMARY_CLASS} />}
      required={false}
      withPhoto
      error={complete.error}
      isPending={complete.isPending}
      onSubmit={(input, done) => complete.mutate(input, { onSuccess: done })}
    />
  );
}

function DeclineAction({ taskId }: { taskId: number }) {
  const decline = useDeclineTask(taskId);
  return (
    <TaskNoteDialog
      copy={DECLINE_COPY}
      trigger={<Button variant="outline" className={SECONDARY_CLASS} />}
      required
      error={decline.error}
      isPending={decline.isPending}
      onSubmit={({ note }, done) => decline.mutate({ reason: note }, { onSuccess: done })}
    />
  );
}

function StepAction({ taskId, action }: { taskId: number; action: "accept" | "start" }) {
  const accept = useAcceptTask(taskId);
  const start = useStartTask(taskId);
  const step = action === "accept" ? { run: accept, label: "Kabul et" } : { run: start, label: "Başlat" };
  return (
    <>
      <FormAlert error={step.run.error} />
      <Button className={PRIMARY_CLASS} disabled={step.run.isPending} onClick={() => step.run.mutate()}>
        {step.label}
      </Button>
    </>
  );
}

export function TaskActionBar({ task }: { task: TaskRead }) {
  const { primary, canDecline } = taskActions(task.status);
  if (!primary) {
    return null;
  }
  return (
    <div className="space-y-2">
      {primary === "complete" ? <CompleteAction task={task} /> : <StepAction taskId={task.id} action={primary} />}
      {canDecline ? <DeclineAction taskId={task.id} /> : null}
    </div>
  );
}
