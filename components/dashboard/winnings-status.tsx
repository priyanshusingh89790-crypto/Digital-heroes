"use client";

import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { submitWinnerProofAction } from "@/lib/dashboard/actions";
import { paymentStateLabel, type WinningsStatusView } from "@/lib/dashboard/mapping";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function stateBadge(state: WinningsStatusView["summary_state"]) {
  if (state === "paid") return <Badge className="bg-emerald-100 text-emerald-800">Paid</Badge>;
  if (state === "approved") return <Badge className="bg-sky-100 text-sky-800">Approved</Badge>;
  if (state === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (state === "pending_verification") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700">
        Pending verification
      </Badge>
    );
  }
  return <Badge variant="outline">No winnings</Badge>;
}

export function WinningsStatusCard({
  winnings,
  error,
}: {
  winnings: WinningsStatusView;
  error?: string | null;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>, winnerId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("winner_id", winnerId);

    try {
      setPendingId(winnerId);
      setFormError(null);
      setSuccess(null);
      await submitWinnerProofAction(data);
      form.reset();
      setSuccess("Proof uploaded. An administrator will review it.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to upload proof.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-600" />
              Winnings and payment
            </CardTitle>
            <CardDescription>Verification and payout status for your prizes</CardDescription>
          </div>
          {stateBadge(winnings.summary_state)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {!winnings.has_winnings ? (
          <p className="text-sm text-muted-foreground">You have no recorded winnings yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-muted-foreground">Pending</p>
                <p className="font-semibold">{winnings.pending_verification}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-muted-foreground">Approved</p>
                <p className="font-semibold">{winnings.approved}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-muted-foreground">Rejected</p>
                <p className="font-semibold">{winnings.rejected}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-muted-foreground">Paid</p>
                <p className="font-semibold">{winnings.paid}</p>
              </div>
            </div>

            <ul className="space-y-4">
              {winnings.recent_winnings.map((winning) => (
                <li key={winning.id} className="min-w-0 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {winning.tier}-match · {winning.prize_formatted}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {paymentStateLabel(winning.payment_state)}
                        {winning.draw_month ? ` · ${winning.draw_month}` : ""}
                      </p>
                    </div>
                    {stateBadge(winning.payment_state)}
                  </div>

                  {winning.rejection_reason && (
                    <p className="mt-2 text-sm text-destructive">{winning.rejection_reason}</p>
                  )}

                  {winning.proofs.length > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Proof on file: {winning.proofs.map((proof) => proof.original_filename).join(", ")}
                    </p>
                  )}

                  {winning.can_upload_proof && (
                    <form
                      className="mt-4 space-y-3"
                      onSubmit={(event) => handleSubmit(event, winning.id)}
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`proof-${winning.id}`}>Upload verification proof</Label>
                        <Input
                          id={`proof-${winning.id}`}
                          name="file"
                          type="file"
                          required
                          accept="image/jpeg,image/png,application/pdf"
                          disabled={pendingId === winning.id}
                        />
                      </div>
                      <Button type="submit" disabled={pendingId === winning.id}>
                        {pendingId === winning.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          "Submit proof"
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        JPEG, PNG, or PDF up to 10MB. You cannot approve your own winnings.
                      </p>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
