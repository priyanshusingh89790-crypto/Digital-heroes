import Link from "next/link";
import { ArrowRight, Heart, Sparkles, Trophy } from "lucide-react";
import { CharityCard } from "@/components/public/charity-card";
import { PublicShell } from "@/components/public/public-shell";
import { SectionHeading } from "@/components/public/section-heading";
import { getCharities, getFeaturedCharity } from "@/lib/public/charities";

export const dynamic = "force-dynamic";

export default async function HomeContent() {
  const { charities } = await getCharities();
  const { charity: featuredCharity } = await getFeaturedCharity();
  const featured = featuredCharity ?? charities.find((item) => item.is_featured) ?? charities[0];

  return (
    <PublicShell>
      <main>
        <section className="relative overflow-hidden px-5 py-20 lg:px-8 lg:py-28">
          <div className="absolute -top-24 right-0 size-96 rounded-full bg-emerald-200/60 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                <Heart className="size-4" /> Play with purpose
              </p>
              <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-[-.06em] text-slate-950 sm:text-7xl">
                Your game can move <span className="text-emerald-700">something bigger.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
                Digital Heroes brings together golf performance, monthly rewards, and meaningful charity impact in one community-led membership.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                  Get started <ArrowRight className="size-4" />
                </Link>
                <Link href="/how-it-works" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold">
                  How it works
                </Link>
              </div>
            </div>
            <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl">
              <p className="text-sm text-emerald-300">A better monthly rhythm</p>
              <p className="mt-8 text-4xl font-semibold">Play. Give. Belong.</p>
              <div className="mt-10 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <Heart className="size-6 text-emerald-300" />
                  <p className="mt-4 text-xs text-slate-300">Impact</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <Sparkles className="size-6 text-emerald-300" />
                  <p className="mt-4 text-xs text-slate-300">Community</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <Trophy className="size-6 text-emerald-300" />
                  <p className="mt-4 text-xs text-slate-300">Rewards</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Featured charity partner"
            title="Making a difference together"
            copy="Each month, a portion of every subscription goes directly to our featured charity partner."
          />
          {featured ? (
            <div className="mt-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                <Heart className="size-4" /> Featured Charity
              </div>
              <CharityCard charity={featured} />
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-600">
              Our featured charity partner will be announced soon.
            </div>
          )}
        </section>

        <section className="bg-slate-50 px-5 py-16 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="All charity partners"
            title="Choose your cause"
            copy="Browse our full directory of charity partners and find one that resonates with you."
          />
          {charities.length ? (
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {charities.map((charity) => (
                <CharityCard key={charity.id} charity={charity} />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-600">
              Our charity directory is being prepared. Please check back soon.
            </div>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
