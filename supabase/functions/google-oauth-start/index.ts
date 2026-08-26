// Starts the Google Calendar OAuth flow: creates a one-time "state" row correlating
// this browser session to the logged-in Supabase user (Google's redirect back won't
// carry our session), and returns the full Google consent-screen URL to redirect to.
// Deploy with JWT verification ON (default) — this must be called by a logged-in user.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing Authorization header" }, { status: 401, headers: CORS_HEADERS });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return Response.json({ error: "Not authenticated" }, { status: 401, headers: CORS_HEADERS });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: stateRow, error: insertErr } = await admin
      .from("google_oauth_states")
      .insert({ user_id: userData.user.id })
      .select("state")
      .single();
    if (insertErr) throw insertErr;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/calendar",
      state: stateRow.state,
    });

    return Response.json(
      { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
});
