"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { type LoginValues, loginSchema } from "@/lib/auth/validation";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialAuthFormState);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const emailError = errors.email?.message ?? state.fieldErrors?.email?.[0];
  const passwordError = errors.password?.message ?? state.fieldErrors?.password?.[0];

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit((_values, event) => {
      const form = event?.currentTarget;
      if (form instanceof HTMLFormElement) startTransition(() => formAction(new FormData(form)));
    })}>
      <AuthFeedback state={state} />
      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined} {...register("email")} />
        {emailError && <p id="email-error" className="text-sm text-destructive">{emailError}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "password-error" : undefined} {...register("password")} />
        {passwordError && <p id="password-error" className="text-sm text-destructive">{passwordError}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <p className="text-sm text-muted-foreground">New to Digital Heroes? <Link className="text-foreground underline" href="/signup">Create an account</Link>.</p>
    </form>
  );
}
