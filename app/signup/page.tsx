import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"><section className="w-full rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-semibold">Create your account</h1><p className="mt-1 mb-6 text-sm text-muted-foreground">Start with a secure Digital Heroes account.</p><SignupForm /></section></main>;
}
