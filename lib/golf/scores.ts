import { z } from "zod";

// Validation schemas (can be imported in tests)
export const scoreSchema = z.object({
  score: z.number().int().min(1).max(45, "Score must be between 1 and 45"),
  score_date: z.string().refine(
    (date) => {
      try {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      } catch {
        return false;
      }
    },
    { message: "Invalid date format" }
  ).refine(
    (date) => {
      const parsed = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return parsed <= today;
    },
    { message: "Score date cannot be in the future" }
  ),
});

export const createScoreSchema = scoreSchema;
export const updateScoreSchema = scoreSchema.extend({
  id: z.string().uuid("Invalid score ID"),
});

export type CreateScoreInput = z.infer<typeof createScoreSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;

export type GolfScore = {
  id: string;
  user_id: string;
  score_date: string;
  stableford_score: number;
  created_at: string;
  updated_at: string;
};
