import Link from "next/link";

export default function UnauthorizedPage() {
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6"><section><p className="text-sm font-medium text-muted-foreground">403</p><h1 className="mt-2 text-3xl font-semibold">You do not have access to this area.</h1><Link className="mt-5 inline-block underline" href="/">Return home</Link></section></main>;
}
