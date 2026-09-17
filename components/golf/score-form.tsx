"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const scoreFormSchema = z.object({
  score: z.number().int().min(1).max(45, "Score must be between 1 and 45"),
  score_date: z.string().min(1, "Date is required"),
});

type ScoreFormValues = z.infer<typeof scoreFormSchema>;

interface ScoreFormProps {
  onSuccess?: (values: ScoreFormValues) => void;
  onCancel?: () => void;
  defaultValues?: Partial<ScoreFormValues>;
  submitLabel?: string;
  mode?: "create" | "update";
}

export function ScoreForm({
  onSuccess,
  onCancel,
  defaultValues,
  submitLabel = "Add Score",
  mode = "create",
}: ScoreFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScoreFormValues>({
    resolver: zodResolver(scoreFormSchema),
    defaultValues: defaultValues || {
      score_date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (values: ScoreFormValues) => {
    setError(null);
    setLoading(true);

    try {
      if (mode === "update") {
        onSuccess?.(values);
        return;
      }

      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save score");
      }

      onSuccess?.(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save score");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="score_date">Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="score_date"
            type="date"
            {...register("score_date")}
            className="pl-9"
            max={new Date().toISOString().split("T")[0]}
          />
        </div>
        {errors.score_date && (
          <p className="text-sm text-destructive">{errors.score_date.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="score">Stableford Score (1-45)</Label>
        <Input
          id="score"
          type="number"
          min="1"
          max="45"
          {...register("score", { valueAsNumber: true })}
        />
        {errors.score && (
          <p className="text-sm text-destructive">{errors.score.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
