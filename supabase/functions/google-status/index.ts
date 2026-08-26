// Reports whether the logged-in user currently has a Google Calendar connection,
// without ever exposing the stored tokens to the client.
// Deploy with JWT verification ON (default).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { data } = await admin
      .from("google_calendar_connections")
      .select("connected_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    return Response.json(
      { connected: !!data, connectedAt: data?.connected_at || null },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
});
