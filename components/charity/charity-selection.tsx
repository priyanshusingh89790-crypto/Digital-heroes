"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Heart, Loader2 } from "lucide-react";
import { getCharitySelectionAction, updateCharitySelectionAction, getCharitiesAction } from "@/lib/charity/actions";
import type { PublicCharity } from "@/lib/public/charities";
import type { UserCharitySelection } from "@/lib/charity/user-charity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CharitySelection({
  initialSelection = null,
  initialCharities,
  initialError = null,
}: {
  initialSelection?: UserCharitySelection | null;
  initialCharities?: PublicCharity[];
  initialError?: string | null;
}) {
  const [charities, setCharities] = useState<PublicCharity[]>(initialCharities ?? []);
  const [selection, setSelection] = useState<UserCharitySelection | null>(initialSelection);
  const [isLoading, setIsLoading] = useState(!initialSelection && !initialCharities);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialSelection || initialCharities) {
      return;
    }

    let isMounted = true;
    
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        
        const [charitiesResult, selectionResult] = await Promise.all([
          getCharitiesAction(),
          getCharitySelectionAction(),
        ]);

        if (isMounted) {
          if (charitiesResult.error) {
            setError(charitiesResult.error);
          } else {
            setCharities(charitiesResult.charities);
          }

          setSelection(selectionResult);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load charity data. Please try again.");
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
  }, [initialSelection, initialCharities]);

  async function handleCharityChange(charityId: string | null) {
    if (!charityId) return;
    
    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(false);

      await updateCharitySelectionAction({ charity_id: charityId });
      
      // Reload selection data
      const updatedSelection = await getCharitySelectionAction();
      setSelection(updatedSelection);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Failed to update charity selection. Please try again.");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Charity</CardTitle>
          <CardDescription>Choose the charity you want to support</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeCharities = charities.filter(c => c.is_active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-emerald-600" />
          Your Charity
        </CardTitle>
        <CardDescription>Choose the charity you want to support</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
            <AlertDescription className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Charity selection updated successfully
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label htmlFor="charity-select" className="text-sm font-medium">
            Selected Charity
          </label>
          <Select
            id="charity-select"
            value={selection?.preferred_charity_id || ""}
            onValueChange={handleCharityChange}
            disabled={isUpdating || activeCharities.length === 0}
          >
            <SelectTrigger className="w-full">
              {isUpdating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                <>
                  <SelectValue placeholder="Select a charity" />
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </>
              )}
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

        {selection?.charity_name && (
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Currently supporting:</p>
            <p className="mt-1 font-semibold text-slate-900">{selection.charity_name}</p>
            {activeCharities.find((charity) => charity.id === selection.preferred_charity_id)?.short_description && (
              <p className="mt-2 text-sm text-slate-600">
                {activeCharities.find((charity) => charity.id === selection.preferred_charity_id)?.short_description}
              </p>
            )}
            {selection.charity_slug && (
              <a 
                href={`/charities/${selection.charity_slug}`} 
                target="_blank" 
                rel="noreferrer"
                className="mt-2 inline-block text-sm underline text-emerald-700 hover:text-emerald-800"
              >
                View charity details →
              </a>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          You can change your selected charity at any time. Your contribution percentage will apply to your chosen charity.
        </p>
      </CardContent>
    </Card>
  );
}
