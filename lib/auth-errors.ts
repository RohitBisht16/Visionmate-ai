/** Turns Supabase auth errors into plain messages. Raw errors are never shown. */
export function friendlyAuthError(error: { message?: string; code?: string; status?: number } | null): string {
  if (!error) return "";
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";

  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "The email or password is incorrect.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "Confirm your email first. Open the link we sent to your inbox, then log in.";
  if (code === "user_already_exists" || msg.includes("already registered"))
    return "An account with this email already exists. Log in instead.";
  if (code === "weak_password" || msg.includes("password should"))
    return "Choose a stronger password with at least 8 characters.";
  if (code === "same_password" || msg.includes("different from the old"))
    return "Choose a password different from your current one.";
  if (error.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts. Wait a few minutes and try again.";
  if (msg.includes("fetch") || msg.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  return "We couldn't complete that. Please try again.";
}
