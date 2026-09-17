"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  scoreDate?: string;
  scoreValue?: number;
  pending?: boolean;
}

export function DeleteScoreDialog({
  open,
  onOpenChange,
  onConfirm,
  scoreDate,
  scoreValue,
  pending = false,
}: DeleteScoreDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Score?</AlertDialogTitle>
          <AlertDialogDescription>
            {scoreDate && scoreValue && (
              <>
                Are you sure you want to delete your score of {scoreValue} from {scoreDate}?
                This action cannot be undone.
              </>
            )}
            {!scoreDate && !scoreValue && (
              <>Are you sure you want to delete this score? This action cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground"
          >
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
