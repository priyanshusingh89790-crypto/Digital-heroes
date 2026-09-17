export const applicationRoles = ["subscriber", "admin"] as const;

export type ApplicationRole = (typeof applicationRoles)[number];

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  role: ApplicationRole;
};

export type AuthenticatedContext = {
  user: { id: string; email?: string };
  profile: CurrentProfile;
};
