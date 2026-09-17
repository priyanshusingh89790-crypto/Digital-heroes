import { Dices } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DrawParticipation } from "@/lib/dashboard/operations";

function NumberPills({ numbers, highlight }: { numbers: number[]; highlight?: number[] }) {
  const highlighted = new Set(highlight ?? []);
  return (
    <div className="flex flex-wrap gap-2">
      {numbers.map((number) => (
        <span
          key={number}
          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold ${
            highlighted.has(number)
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-900"
          }`}
        >
          {number}
        </span>
      ))}
    </div>
  );
}

export function DrawParticipationCard({
  draw,
  error,
}: {
  draw: DrawParticipation;
  error?: string | null;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="h-5 w-5 text-emerald-600" />
          Draw participation
        </CardTitle>
        <CardDescription>Latest published monthly draw for your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !draw.has_draw ? (
          <p className="text-sm text-muted-foreground">
            No published draw is available yet. Results appear here after a monthly draw is published.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Draw month</p>
                <p className="font-semibold">{draw.formatted_draw_month ?? draw.draw_month}</p>
              </div>
              {draw.is_winner ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  Winner{draw.winner_tier ? ` · ${draw.winner_tier}-match` : ""}
                </Badge>
              ) : draw.has_entry && draw.matched_tier_label === "no-match" ? (
                <Badge variant="outline">No winning match</Badge>
              ) : null}
            </div>

            {draw.draw_numbers && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Draw numbers</p>
                <NumberPills numbers={draw.draw_numbers} highlight={draw.matched_numbers ?? undefined} />
              </div>
            )}

            {!draw.has_entry ? (
              <Alert>
                <AlertDescription>
                  You did not have an entry in this draw. Entries are created from eligible subscribers with
                  five scores at publish time.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {draw.user_entry_numbers && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Your entry numbers</p>
                    <NumberPills
                      numbers={draw.user_entry_numbers}
                      highlight={draw.matched_numbers ?? undefined}
                    />
                  </div>
                )}
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">Matching result</p>
                  <p className="mt-1 font-semibold">
                    {draw.matched_count === null
                      ? "Result not recorded"
                      : `${draw.matched_count} of 5 numbers matched`}
                  </p>
                  {draw.matched_tier_label && draw.matched_tier_label !== "no-match" && (
                    <p className="mt-1 text-sm text-emerald-700">
                      You matched {draw.matched_tier_label.replace("-match", "")} numbers.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
