import "server-only";

import { z } from "zod";
import { requireSubscriber } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { canUploadWinnerProof } from "./mapping";

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_PROOFS_PER_WINNER = 5;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

const winnerIdSchema = z.string().uuid("Invalid winner ID");

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

export async function submitWinnerProof(input: { winnerId: string; file: File }) {
  const { user } = await requireSubscriber();
  const winnerId = winnerIdSchema.parse(input.winnerId);
  const file = input.file;

  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("A proof file is required.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("Proof files must be 10MB or smaller.");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Proof must be a JPEG, PNG, or PDF file.");
  }

  const supabase = await createClient();

  const { data: winner, error: winnerError } = await supabase
    .from("winners")
    .select("id, user_id, verification_status")
    .eq("id", winnerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (winnerError || !winner) {
    throw new Error("Winning record not found.");
  }

  if (!canUploadWinnerProof(winner.verification_status)) {
    throw new Error("Proof can only be uploaded while verification is pending.");
  }

  const { count, error: countError } = await supabase
    .from("winner_proofs")
    .select("id", { count: "exact", head: true })
    .eq("winner_id", winnerId);

  if (countError) {
    throw new Error("Unable to check existing proofs.");
  }
  if ((count ?? 0) >= MAX_PROOFS_PER_WINNER) {
    throw new Error("Maximum number of proof files reached for this winning.");
  }

  const storagePath = `${user.id}/${winnerId}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
  const { error: uploadError } = await supabase.storage
    .from("winner-proofs")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload proof: ${uploadError.message}`);
  }

  const { error: insertError } = await supabase.from("winner_proofs").insert({
    winner_id: winnerId,
    storage_path: storagePath,
    original_filename: file.name || `proof.${extensionForMime(file.type)}`,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (insertError) {
    await supabase.storage.from("winner-proofs").remove([storagePath]);
    throw new Error(`Failed to save proof: ${insertError.message}`);
  }

  return { success: true as const };
}
