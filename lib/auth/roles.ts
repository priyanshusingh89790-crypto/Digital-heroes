import type { ApplicationRole } from "./types";

/** Public visitors are unauthenticated; persisted profiles are subscriber/admin. */
export function isApplicationRole(value: unknown): value is ApplicationRole {
  return value === "subscriber" || value === "admin";
}

export function canAccessSubscriberArea(role: ApplicationRole) {
  return role === "subscriber" || role === "admin";
}

export function canAccessAdminArea(role: ApplicationRole) {
  return role === "admin";
}
