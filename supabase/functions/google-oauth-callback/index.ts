// Google redirects here after the user approves/denies calendar access. This request
// comes straight from the browser following Google's redirect — it carries no Supabase
// session, so the user is identified via the one-time `state` row created by
// google-oauth-start. Deploy this function with JWT verification OFF (it has no
// Authorization header to check — Google doesn't send one).

import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;
const APP_URL = Deno.env.get("APP_URL")!; // e.g. https://sashka2022.github.io/banik/
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function redirectTo(status: string, message?: string) {
  const url = `${APP_URL}#/dashboard?google=${status}${message ? `&message=${encodeURIComponent(message)}` : ""}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return redirectTo("error", oauthError);
  if (!code || !state) return redirectTo("error", "Missing code or state");

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: stateRow, error: stateErr } = await admin
      .from("google_oauth_states")
      .select("user_id")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow) return redirectTo("error", "Invalid or expired state");
    await admin.from("google_oauth_states").delete().eq("state", state);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return redirectTo("error", `Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first-ever consent for this client+account
      // (or when prompt=consent forces re-consent, which google-oauth-start already sets).
      // If this still happens, the user likely needs to revoke prior access first.
      return redirectTo(
        "error",
        "לא התקבל refresh_token — נסה לבטל את הגישה של האפליקציה בהגדרות חשבון Google שלך ולהתחבר מחדש"
      );
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    const { error: upsertErr } = await admin.from("google_calendar_connections").upsert({
      user_id: stateRow.user_id,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    });
    if (upsertErr) throw upsertErr;

    return redirectTo("connected");
  } catch (e) {
    return redirectTo("error", e.message);
  }
});
