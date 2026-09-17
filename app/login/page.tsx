import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"><section className="w-full rounded-xl border bg-card p-6 shadow-sm"><h1 className="text-2xl font-semibold">Welcome back</h1><p className="mt-1 mb-6 text-sm text-muted-foreground">Sign in to your Digital Heroes account.</p><LoginForm /></section></main>;
}
