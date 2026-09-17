import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ScoreEmptyStateProps {
  onAddScore?: () => void;
}

export function ScoreEmptyState({ onAddScore }: ScoreEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Plus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">No scores yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Start tracking your golf performance by adding your first Stableford score.
        </p>
        {onAddScore && (
          <Button onClick={onAddScore} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Score
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
