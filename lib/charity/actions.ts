"use server";

import { revalidatePath } from "next/cache";
import { getUserCharitySelection, updateCharitySelection, updateContributionPercentage, calculateContribution } from "./user-charity";
import { createDonationCheckout, getUserDonations } from "./donation";
import { getCharities } from "../public/charities";
import type { UpdateCharitySelectionInput, UpdateContributionPercentageInput } from "./user-charity";
import type { CreateDonationInput } from "./donation";

/**
 * Server action to get current user's charity selection
 */
export async function getCharitySelectionAction() {
  try {
    return await getUserCharitySelection();
  } catch (error) {
    console.error("Failed to get charity selection:", error);
    throw error;
  }
}

/**
 * Server action to get charities for client components
 */
export async function getCharitiesAction() {
  try {
    const result = await getCharities();
    return result;
  } catch (error) {
    console.error("Failed to get charities:", error);
    throw error;
  }
}

/**
 * Server action to update user's charity selection
 */
export async function updateCharitySelectionAction(input: UpdateCharitySelectionInput) {
  try {
    const result = await updateCharitySelection(input);
    revalidatePath("/dashboard");
    revalidatePath("/charities");
    return result;
  } catch (error) {
    console.error("Failed to update charity selection:", error);
    throw error;
  }
}

/**
 * Server action to update user's contribution percentage
 */
export async function updateContributionPercentageAction(input: UpdateContributionPercentageInput) {
  try {
    const result = await updateContributionPercentage(input);
    revalidatePath("/dashboard");
    return result;
  } catch (error) {
    console.error("Failed to update contribution percentage:", error);
    throw error;
  }
}

/**
 * Server action to calculate contribution amount
 */
export async function calculateContributionAction() {
  try {
    return await calculateContribution();
  } catch (error) {
    console.error("Failed to calculate contribution:", error);
    throw error;
  }
}

/**
 * Server action to create a donation checkout session
 */
export async function createDonationCheckoutAction(input: CreateDonationInput) {
  try {
    return await createDonationCheckout(input);
  } catch (error) {
    console.error("Failed to create donation checkout:", error);
    throw error;
  }
}

/**
 * Server action to get user's donation history
 */
export async function getUserDonationsAction() {
  try {
    return await getUserDonations();
  } catch (error) {
    console.error("Failed to get donation history:", error);
    throw error;
  }
}
