"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2, ArrowRight, CreditCard } from "lucide-react";
import { getCharitiesAction, createDonationCheckoutAction, getUserDonationsAction } from "@/lib/charity/actions";
import type { PublicCharity } from "@/lib/public/charities";
import type { CreateDonationInput } from "@/lib/charity/donation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DonationForm() {
  const [charities, setCharities] = useState<PublicCharity[]>([]);
  const [selectedCharityId, setSelectedCharityId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [donationHistory, setDonationHistory] = useState<Array<{
    id: string;
    amount_minor: number;
    currency: string;
    created_at: string;
    charities: {
      name: string;
    };
  }>>([]);

  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [charitiesResult, historyResult] = await Promise.all([
          getCharitiesAction(),
          getUserDonationsAction(),
        ]);

        if (isMounted) {
          if (charitiesResult.error) {
            setError(charitiesResult.error);
          } else {
            setCharities(charitiesResult.charities);
          }

          setDonationHistory(historyResult.map(item => {
        const charityData = item.charities as any;
        let charityName = "Unknown charity";
        
        if (Array.isArray(charityData) && charityData.length > 0) {
          charityName = charityData[0].name;
        } else if (typeof charityData === 'object' && charityData !== null && !Array.isArray(charityData)) {
          charityName = charityData.name;
        }
        
        return {
          id: item.id,
          amount_minor: item.amount_minor,
          currency: item.currency,
          created_at: item.created_at,
          charities: { name: charityName },
        };
      }));
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load donation data. Please try again.");
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
  }, []);

  async function handleCreateDonation() {
    const amountMinor = parseInt(amount, 10) * 100; // Convert to pence
    
    if (!selectedCharityId) {
      setError("Please select a charity");
      return;
    }

    if (isNaN(amountMinor) || amountMinor < 100) {
      setError("Minimum donation is £1.00");
      return;
    }

    if (amountMinor > 1000000) {
      setError("Maximum donation is £10,000.00");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const input: CreateDonationInput = {
        charity_id: selectedCharityId,
        amount_minor: amountMinor,
        currency: "GBP",
      };

      const result = await createDonationCheckoutAction(input);
      
      // Redirect to Stripe checkout
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err) {
      setError("Failed to create donation. Please try again.");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  function handleCharityChange(value: string | null) {
    if (value) {
      setSelectedCharityId(value);
    }
  }

  function formatCurrency(amountMinor: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  }

  const activeCharities = charities.filter(c => c.is_active);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Make a Donation</CardTitle>
          <CardDescription>Support your favorite charity with a one-time donation</CardDescription>
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
          <Heart className="h-5 w-5 text-emerald-600" />
          Make a Donation
        </CardTitle>
        <CardDescription>Support your favorite charity with a one-time donation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="charity">Select Charity</Label>
            <Select
              id="charity"
              value={selectedCharityId}
              onValueChange={handleCharityChange}
              disabled={isCreating || activeCharities.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a charity" />
              </SelectTrigger>
              <SelectContent>
                {activeCharities.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No active charities available
                  </div>
                ) : (
                  activeCharities.map((charity) => (
                    <SelectItem key={charity.id} value={charity.id}>
                      <div className="flex items-center gap-2">
                        {charity.is_featured && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Featured
                          </span>
                        )}
                        <span>{charity.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Donation Amount (GBP)</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max="10000"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isCreating}
              placeholder="10.00"
            />
            <p className="text-xs text-muted-foreground">
              Minimum £1.00, maximum £10,000.00
            </p>
          </div>

          <Button
            onClick={handleCreateDonation}
            disabled={isCreating || !selectedCharityId || !amount}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating checkout...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {donationHistory.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-3">Recent Donations</h3>
            <div className="space-y-2">
              {donationHistory.slice(0, 3).map((donation) => (
                <div key={donation.id} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50">
                  <div>
                    <p className="font-medium">{donation.charities.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(donation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(donation.amount_minor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
