"use client";

import { useState, useEffect } from "react";
import { Loader2, Percent, TrendingUp } from "lucide-react";
import { getCharitySelectionAction, updateContributionPercentageAction, calculateContributionAction } from "@/lib/charity/actions";
import type { UserCharitySelection } from "@/lib/charity/user-charity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ContributionData = {
  amount_minor: number;
  percentage: number;
  currency: string;
  subscription_amount_minor: number;
  plan_interval: string;
};

export function ContributionPercentage({
  initialSelection = null,
  initialContribution = null,
  initialError = null,
}: {
  initialSelection?: UserCharitySelection | null;
  initialContribution?: ContributionData | null;
  initialError?: string | null;
}) {
  const [selection, setSelection] = useState<UserCharitySelection | null>(initialSelection);
  const [contribution, setContribution] = useState<ContributionData | null>(initialContribution);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSelection && !initialContribution);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState(false);
  const [localPercentage, setLocalPercentage] = useState<string>(
    initialSelection?.charity_contribution_percentage.toString() ?? "",
  );

  useEffect(() => {
    if (initialSelection || initialContribution) {
      return;
    }

    let isMounted = true;
    
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [selectionResult, contributionResult] = await Promise.all([
          getCharitySelectionAction(),
          calculateContributionAction(),
        ]);

        if (isMounted) {
          setSelection(selectionResult);
          setContribution(contributionResult);
          setLocalPercentage(selectionResult.charity_contribution_percentage.toString());
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load contribution data. Please try again.");
          console.error(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [initialSelection, initialContribution]);

  async function handleUpdatePercentage() {
    const percentage = parseInt(localPercentage, 10);
    
    if (isNaN(percentage) || percentage < 10 || percentage > 100) {
      setError("Contribution must be between 10% and 100%");
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(false);

      await updateContributionPercentageAction({ percentage });
      
      // Reload data
      const [selectionResult, contributionResult] = await Promise.all([
        getCharitySelectionAction(),
        calculateContributionAction(),
      ]);

      setSelection(selectionResult);
      setContribution(contributionResult);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Failed to update contribution percentage. Please try again.");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  }

  function formatCurrency(amountMinor: number, currency: string): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Amount</CardTitle>
          <CardDescription>Set how much of your subscription goes to charity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-emerald-600" />
          Contribution Amount
        </CardTitle>
        <CardDescription>Set how much of your subscription goes to charity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
            <AlertDescription className="flex items-center gap-2">
              Contribution percentage updated successfully
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="percentage">Contribution Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                id="percentage"
                type="number"
                min="10"
                max="100"
                value={localPercentage}
                onChange={(e) => setLocalPercentage(e.target.value)}
                disabled={isUpdating}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum 10% of your subscription fee
            </p>
          </div>

          <Button
            onClick={handleUpdatePercentage}
            disabled={isUpdating || localPercentage === selection?.charity_contribution_percentage.toString()}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Contribution"
            )}
          </Button>
        </div>

        {contribution && (
          <div className="rounded-lg bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Current Contribution
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subscription amount:</span>
                <span className="font-medium">
                  {formatCurrency(contribution.subscription_amount_minor, contribution.currency)}
                  /{contribution.plan_interval === 'month' ? 'month' : 'year'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contribution percentage:</span>
                <span className="font-medium">{contribution.percentage}%</span>
              </div>
              
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-muted-foreground">Monthly contribution:</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(contribution.amount_minor, contribution.currency)}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              {contribution.plan_interval === 'year' 
                ? "Note: For yearly subscriptions, the contribution is calculated as a percentage of the annual amount."
                : "Your contribution is calculated as a percentage of your monthly subscription fee."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
