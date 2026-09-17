"use server";

import { revalidatePath } from "next/cache";
import { getSubscriptionStatus, getDrawParticipation, getWinningsStatus } from "./operations";
import { submitWinnerProof } from "./proofs";

export async function getSubscriptionStatusAction() {
  return getSubscriptionStatus();
}

export async function getDrawParticipationAction() {
  return getDrawParticipation();
}

export async function getWinningsStatusAction() {
  return getWinningsStatus();
}

export async function submitWinnerProofAction(formData: FormData) {
  const winnerId = String(formData.get("winner_id") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("A proof file is required.");
  }

  const result = await submitWinnerProof({ winnerId, file });
  revalidatePath("/dashboard");
  return result;
}
