import { format } from "date-fns";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface GolfScore {
  id: string;
  score_date: string;
  stableford_score: number;
}

interface ScoreCardProps {
  score: GolfScore;
  onEdit?: (score: GolfScore) => void;
  onDelete?: (score: GolfScore) => void;
}

export function ScoreCard({ score, onEdit, onDelete }: ScoreCardProps) {
  const formattedDate = format(new Date(score.score_date), "MMM d, yyyy");

  return (
    <Card>
      <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
          <p className="text-2xl font-semibold">{score.stableford_score}</p>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(score)}
              aria-label="Edit score"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(score)}
              aria-label="Delete score"
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
