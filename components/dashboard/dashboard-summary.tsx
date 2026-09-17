import { CalendarDays, Gift, Heart, Percent, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummaryView } from "@/lib/dashboard/mapping";

const items: Array<{
  key: keyof DashboardSummaryView | "score";
  title: string;
  icon: typeof Heart;
  value: (summary: DashboardSummaryView) => string;
}> = [
  {
    key: "subscription_label",
    title: "Subscription",
    icon: Gift,
    value: (summary) => summary.subscription_label,
  },
  {
    key: "score",
    title: "Latest Stableford",
    icon: Target,
    value: (summary) =>
      summary.latest_score === null ? "No scores yet" : String(summary.latest_score),
  },
  {
    key: "charity_name",
    title: "Selected charity",
    icon: Heart,
    value: (summary) => summary.charity_name ?? "Not selected",
  },
  {
    key: "contribution_formatted",
    title: "Charity contribution",
    icon: Percent,
    value: (summary) =>
      summary.contribution_formatted
        ? `${summary.contribution_formatted}${summary.contribution_percentage ? ` (${summary.contribution_percentage}%)` : ""}`
        : "Unavailable",
  },
  {
    key: "latest_draw_label",
    title: "Latest draw",
    icon: CalendarDays,
    value: (summary) => summary.latest_draw_label,
  },
  {
    key: "winnings_label",
    title: "Winnings / payment",
    icon: Trophy,
    value: (summary) => summary.winnings_label,
  },
];

export function DashboardSummary({ summary }: { summary: DashboardSummaryView }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
              <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <p className="truncate text-lg font-semibold text-slate-900">{item.value(summary)}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
