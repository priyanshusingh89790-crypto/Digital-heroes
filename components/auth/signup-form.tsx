"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { AuthFeedback } from "@/components/auth/auth-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { type SignupValues, signupSchema } from "@/lib/auth/validation";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialAuthFormState);
  const { register, handleSubmit, formState: { errors } } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });
  const messageFor = (name: keyof SignupValues) => errors[name]?.message ?? state.fieldErrors?.[name]?.[0];

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit((_values, event) => {
      const form = event?.currentTarget;
      if (form instanceof HTMLFormElement) startTransition(() => formAction(new FormData(form)));
    })}>
      <AuthFeedback state={state} />
      {([ ["fullName", "Full name", "text", "name"], ["email", "Email address", "email", "email"], ["password", "Password", "password", "new-password"], ["confirmPassword", "Confirm password", "password", "new-password"] ] as const).map(([name, label, type, autoComplete]) => {
        const message = messageFor(name);
        return <div key={name} className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input id={name} type={type} autoComplete={autoComplete} aria-invalid={Boolean(message)} aria-describedby={message ? `${name}-error` : undefined} {...register(name)} />{message && <p id={`${name}-error`} className="text-sm text-destructive">{message}</p>}</div>;
      })}
      <Button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-sm text-muted-foreground">Already have an account? <Link className="text-foreground underline" href="/login">Sign in</Link>.</p>
    </form>
  );
}
