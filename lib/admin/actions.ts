"use server";

import { revalidatePath } from "next/cache";
import {
  createCharityEvent,
  deleteCharityEvent,
  getAdminData,
  getAdminOverview,
  markWinnerPaid,
  reviewWinner,
  setCharityActive,
  uploadCharityMedia,
  upsertCharity,
  adminCreateDraw,
  adminSimulateDraw,
  adminPublishDraw,
  adminUpdateDraw,
  adminCancelDraw,
} from "./operations";

const refreshAdmin = () => {
  revalidatePath("/admin");
  revalidatePath("/charities", "page");
  revalidatePath("/", "page");
};

export async function createOrUpdateCharityAction(formData: FormData) {
  await upsertCharity({
    id: String(formData.get("id") || "") || undefined,
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    short_description: String(formData.get("short_description") || ""),
    description: String(formData.get("description") || ""),
    website_url: String(formData.get("website_url") || ""),
    image_path: String(formData.get("image_path") || ""),
    is_featured: formData.get("is_featured") === "on",
    is_active: formData.get("is_active") !== "off",
  });
  refreshAdmin();
}

export async function setCharityActiveAction(formData: FormData) {
  await setCharityActive({
    charity_id: String(formData.get("charity_id") || ""),
    active: formData.get("active") === "true",
  });
  refreshAdmin();
}

export async function createCharityEventAction(formData: FormData) {
  const starts = String(formData.get("starts_at") || "");
  const ends = String(formData.get("ends_at") || "");
  await createCharityEvent({
    charity_id: String(formData.get("charity_id") || ""),
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || "") || undefined,
    starts_at: new Date(starts).toISOString(),
    ends_at: ends ? new Date(ends).toISOString() : "",
    location: String(formData.get("location") || "") || undefined,
    registration_url: String(formData.get("registration_url") || "") || undefined,
  });
  refreshAdmin();
}

export async function deleteCharityEventAction(formData: FormData) {
  await deleteCharityEvent(String(formData.get("event_id") || ""));
  refreshAdmin();
}

export async function uploadCharityMediaAction(formData: FormData) {
  const charityId = String(formData.get("charity_id") || "");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Please select an image.");
  await uploadCharityMedia({ charityId, file });
  refreshAdmin();
}

export async function createDrawAction(formData: FormData) {
  await adminCreateDraw({
    draw_month: String(formData.get("draw_month") || ""),
    type: String(formData.get("type") || "random") as "random" | "algorithmic",
  });
  refreshAdmin();
}

export async function simulateDrawAction(formData: FormData) {
  await adminSimulateDraw(String(formData.get("draw_id") || ""), String(formData.get("seed") || "") || undefined);
  refreshAdmin();
}

export async function publishDrawAction(formData: FormData) {
  await adminPublishDraw(String(formData.get("draw_id") || ""));
  refreshAdmin();
}

export async function updateDrawAction(formData: FormData) {
  await adminUpdateDraw({
    draw_id: String(formData.get("draw_id") || ""),
    type: String(formData.get("type") || "") as "random" | "algorithmic" || undefined,
  });
  refreshAdmin();
}

export async function cancelDrawAction(formData: FormData) {
  await adminCancelDraw(String(formData.get("draw_id") || ""));
  refreshAdmin();
}

export async function reviewWinnerAction(formData: FormData) {
  await reviewWinner({
    winner_id: String(formData.get("winner_id") || ""),
    decision: String(formData.get("decision") || "") as "approved" | "rejected",
    reason: String(formData.get("reason") || "") || undefined,
  });
  refreshAdmin();
}

export async function markWinnerPaidAction(formData: FormData) {
  await markWinnerPaid({
    winner_id: String(formData.get("winner_id") || ""),
    provider_reference: String(formData.get("provider_reference") || "") || undefined,
  });
  refreshAdmin();
}

export async function loadAdminDataAction() {
  return getAdminData();
}

export async function loadAdminOverviewAction() {
  return getAdminOverview();
}
