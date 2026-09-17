export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };
