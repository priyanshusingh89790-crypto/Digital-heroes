import { AlertCircle, Calendar, CheckCircle, CreditCard, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionStatus } from "@/lib/dashboard/operations";

export function SubscriptionStatusCard({
  subscription,
  error,
}: {
  subscription: SubscriptionStatus | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!subscription || subscription.status === "none") {
    return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            <span>No active subscription</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusBadge = !subscription.is_active ? (
    <Badge variant="destructive">Inactive</Badge>
  ) : subscription.cancellation_status === "scheduled" ? (
    <Badge variant="outline" className="border-amber-500 text-amber-700">
      Cancellation scheduled
    </Badge>
  ) : (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Active</Badge>
  );

  const statusIcon = !subscription.is_active ? (
    <XCircle className="h-4 w-4 text-red-600" />
  ) : subscription.cancellation_status === "scheduled" ? (
    <AlertCircle className="h-4 w-4 text-amber-600" />
  ) : (
    <CheckCircle className="h-4 w-4 text-emerald-600" />
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 shrink-0 text-emerald-600" />
              Subscription
            </CardTitle>
            <CardDescription className="mt-2">{subscription.plan_label} plan</CardDescription>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Access</span>
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-sm font-medium">
              {subscription.is_active ? "Currently active" : "Inactive / lapsed"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Amount</span>
          <span className="text-sm font-semibold">
            {subscription.formatted_amount}/{subscription.plan_interval === "year" ? "year" : "month"}
          </span>
        </div>

        {subscription.formatted_period_end && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {subscription.cancellation_status === "scheduled" ? "Access ends" : "Renews / period end"}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium">{subscription.formatted_period_end}</span>
            </div>
          </div>
        )}

        {subscription.cancellation_status === "scheduled" && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cancellation is scheduled. You keep access until {subscription.formatted_period_end}, then the
              subscription ends.
            </AlertDescription>
          </Alert>
        )}

        {!subscription.is_active && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              This subscription is inactive or lapsed
              {subscription.formatted_period_end ? ` (ended ${subscription.formatted_period_end})` : ""}.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
