"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { AuthFormState } from "@/lib/auth/form-state";

export function AuthFeedback({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"}>
      <AlertTitle>{state.status === "error" ? "Something needs attention" : "Almost there"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
