"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreForm } from "./score-form";
import { ScoreList } from "./score-list";
import { ScoreEmptyState } from "./score-empty-state";
import { DeleteScoreDialog } from "./delete-score-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GolfScore {
  id: string;
  score_date: string;
  stableford_score: number;
}

export function ScoreManagement({ initialScores }: { initialScores?: GolfScore[] }) {
  const [scores, setScores] = useState<GolfScore[]>(initialScores ?? []);
  const [loading, setLoading] = useState(!initialScores);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingScore, setEditingScore] = useState<GolfScore | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingScore, setDeletingScore] = useState<GolfScore | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialScores) {
      return;
    }

    const loadScores = async () => {
      try {
        setError(null);
        const response = await fetch("/api/scores");
        if (!response.ok) {
          throw new Error("Failed to fetch scores");
        }
        const data = await response.json();
        setScores(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch scores");
      } finally {
        setLoading(false);
      }
    };

    loadScores();
  }, [initialScores]);

  const handleAddSuccess = () => {
    setShowAddDialog(false);
    setLoading(true);
    (async () => {
      try {
        setError(null);
        const response = await fetch("/api/scores");
        if (!response.ok) {
          throw new Error("Failed to fetch scores");
        }
        const data = await response.json();
        setScores(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch scores");
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleEditClick = (score: GolfScore) => {
    setEditingScore(score);
    setShowEditDialog(true);
  };

  const handleEditSuccess = async (values: { score: number; score_date: string }) => {
    if (!editingScore) return;

    try {
      setError(null);
      const response = await fetch(`/api/scores/${editingScore.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update score");
      }

      setShowEditDialog(false);
      setEditingScore(null);
      setLoading(true);
      (async () => {
        try {
          setError(null);
          const response = await fetch("/api/scores");
          if (!response.ok) {
            throw new Error("Failed to fetch scores");
          }
          const data = await response.json();
          setScores(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch scores");
        } finally {
          setLoading(false);
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update score");
    }
  };

  const handleDeleteClick = (score: GolfScore) => {
    setDeletingScore(score);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingScore) return;

    try {
      setError(null);
      setDeleting(true);
      const response = await fetch(`/api/scores/${deletingScore.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete score");
      }

      setShowDeleteDialog(false);
      setDeletingScore(null);
      setLoading(true);
      (async () => {
        try {
          setError(null);
          const response = await fetch("/api/scores");
          if (!response.ok) {
            throw new Error("Failed to fetch scores");
          }
          const data = await response.json();
          setScores(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch scores");
        } finally {
          setLoading(false);
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete score");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Golf Scores</h2>
          <p className="text-sm text-muted-foreground">{scores.length} of 5 scores stored</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Score
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : scores.length === 0 ? (
        <ScoreEmptyState onAddScore={() => setShowAddDialog(true)} />
      ) : (
        <ScoreList
          scores={scores}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      )}

      {/* Add Score Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Golf Score</DialogTitle>
          </DialogHeader>
          <ScoreForm onSuccess={handleAddSuccess} onCancel={() => setShowAddDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Score Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Golf Score</DialogTitle>
          </DialogHeader>
          {editingScore && (
            <ScoreForm
              mode="update"
              defaultValues={{
                score: editingScore.stableford_score,
                score_date: editingScore.score_date,
              }}
              onSuccess={(values) => handleEditSuccess(values)}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingScore(null);
              }}
              submitLabel="Update Score"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteScoreDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
        scoreDate={deletingScore ? format(new Date(deletingScore.score_date), "MMM d, yyyy") : undefined}
        scoreValue={deletingScore?.stableford_score}
        pending={deleting}
      />
    </div>
  );
}
