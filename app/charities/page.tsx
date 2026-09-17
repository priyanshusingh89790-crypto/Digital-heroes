import { PublicShell } from "@/components/public/public-shell";
import { CharityGrid } from "@/components/public/charity-grid";
import { SectionHeading } from "@/components/public/section-heading";
import { getCharities } from "@/lib/public/charities";
export const dynamic = "force-dynamic";
export default async function CharitiesPage() { const { charities, error } = await getCharities(); return <PublicShell><main className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><SectionHeading eyebrow="Our charity partners" title="Choose a cause that feels personal." copy="Every Digital Heroes community starts with a shared belief that participation can have a wider impact." />{error ? <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{error} Please try again shortly.</div> : charities.length ? <div className="mt-12"><CharityGrid charities={charities} /></div> : <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-600">Our charity directory is being prepared. Please check back soon.</div>}</main></PublicShell>; }
