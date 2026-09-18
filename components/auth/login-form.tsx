"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthFormState);

  return (
    <form className="grid gap-4" action={formAction}>
      <AuthFeedback state={state} />

      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {state.fieldErrors?.email?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        {state.fieldErrors?.password?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-sm text-muted-foreground">
        New to Digital Heroes? <Link className="text-foreground underline" href="/signup">Create an account</Link>.
      </p>
    </form>
  );
}
