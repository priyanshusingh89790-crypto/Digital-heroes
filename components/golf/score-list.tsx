import { ScoreCard } from "./score-card";

interface GolfScore {
  id: string;
  score_date: string;
  stableford_score: number;
}

interface ScoreListProps {
  scores: GolfScore[];
  onEdit?: (score: GolfScore) => void;
  onDelete?: (score: GolfScore) => void;
}

export function ScoreList({ scores, onEdit, onDelete }: ScoreListProps) {
  if (scores.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {scores.map((score) => (
        <ScoreCard
          key={score.id}
          score={score}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
