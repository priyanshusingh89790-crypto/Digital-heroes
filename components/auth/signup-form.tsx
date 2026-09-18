"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialAuthFormState);

  return (
    <form className="grid gap-4" action={formAction}>
      <AuthFeedback state={state} />

      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" type="text" autoComplete="name" required minLength={2} />
        {state.fieldErrors?.fullName?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.fullName[0]}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {state.fieldErrors?.email?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        {state.fieldErrors?.password?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
        {state.fieldErrors?.confirmPassword?.[0] && <p className="text-sm text-destructive">{state.fieldErrors.confirmPassword[0]}</p>}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Already have an account? <Link className="text-foreground underline" href="/login">Sign in</Link>.
      </p>
    </form>
  );
}
