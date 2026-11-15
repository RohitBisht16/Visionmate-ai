type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Please try again.",
  email_not_confirmed: "Please confirm your email address first. Check your inbox for the link.",
  user_already_exists: "An account with this email already exists. Try signing in instead.",
  email_exists: "An account with this email already exists. Try signing in instead.",
  weak_password: "That password is too weak. Use at least 8 characters with a mix of letters and numbers.",
  same_password: "Your new password must be different from your current one.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  validation_failed: "Please check the details you entered.",
  email_address_invalid: "Please enter a valid email address.",
  signup_disabled: "New sign-ups are currently disabled.",
  user_not_found: "We couldn't find an account with that email.",
  session_not_found: "Your session has expired. Please sign in again.",
  otp_expired: "That link has expired or was already used. Request a new one.",
};

/** Maps a Supabase auth error to a short, human-readable message. */
export function friendlyAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  const msg = (error.message ?? "").toLowerCase();
  if (msg === "network" || msg.includes("failed to fetch") || msg.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (msg.includes("invalid login credentials")) return BY_CODE.invalid_credentials;
  if (msg.includes("email not confirmed")) return BY_CODE.email_not_confirmed;
  if (msg.includes("already registered") || msg.includes("already exists")) return BY_CODE.user_already_exists;
  if (msg.includes("password should be") || msg.includes("weak")) return BY_CODE.weak_password;
  if (msg.includes("rate limit") || error.status === 429) return BY_CODE.over_request_rate_limit;
  if (msg.includes("expired")) return BY_CODE.otp_expired;

  return error.message || "Something went wrong. Please try again.";
}
