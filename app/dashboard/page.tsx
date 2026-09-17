import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { AuthenticationRequiredError, AuthorizationError } from "@/lib/auth/authorization";
import { CharitySelection, ContributionPercentage, DonationForm } from "@/components/charity";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { DrawParticipationCard } from "@/components/dashboard/draw-participation";
import { SubscriptionStatusCard } from "@/components/dashboard/subscription-status";
import { WinningsStatusCard } from "@/components/dashboard/winnings-status";
import { ScoreManagement } from "@/components/golf/score-management";
import { Button } from "@/components/ui/button";
import { loadSubscriberDashboard } from "@/lib/dashboard/operations";

export default async function DashboardPage() {
  const data = await loadDashboard();

  return (
    <main className="min-h-screen bg-[#f8f7f3]">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-700">Subscriber dashboard</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Your Digital Heroes overview</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              Signed in as {data.userEmail ?? "your account"}
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </header>

        <DashboardSummary summary={data.summary} />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SubscriptionStatusCard subscription={data.subscription} error={data.subscriptionError} />
          <DrawParticipationCard draw={data.draw} error={data.drawError} />
        </section>

        <section className="min-w-0 space-y-4">
          {data.scoresError ? (
            <p className="text-sm text-destructive">{data.scoresError}</p>
          ) : null}
          <ScoreManagement initialScores={data.scores} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CharitySelection
            initialSelection={data.charitySelection}
            initialCharities={data.charities}
            initialError={data.charityError}
          />
          <ContributionPercentage
            initialSelection={data.charitySelection}
            initialContribution={data.contribution}
            initialError={data.contributionError ?? data.charityError}
          />
        </section>

        <WinningsStatusCard winnings={data.winnings} error={data.winningsError} />

        <DonationForm />
      </div>
    </main>
  );
}

async function loadDashboard() {
  try {
    return await loadSubscriberDashboard();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/unauthorized");
    throw error;
  }
}
