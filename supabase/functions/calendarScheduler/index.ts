// Real Google Calendar integration, replacing the mock. This ports the free/busy and
// event-creation logic from the original Base44 function (base44/functions/calendarScheduler/entry.ts)
// almost verbatim — that part was already correct. What's genuinely different:
//
// - Token handling: the original used Base44's `connectors.getConnection('googlecalendar')`
//   "magic", which only exists on Base44's platform. Here we store/refresh the Google
//   refresh_token ourselves in the google_calendar_connections table (see google-oauth-*).
// - Slot ranking: the original asked an LLM to read task titles and guess whether each was
//   "creative/study" vs "admin/routine" work, then rank free slots accordingly. We have no
//   LLM wired up, so this ranks purely by priority (high->morning, medium->afternoon,
//   low->evening) instead. That's a real simplification, not an equivalent swap-in.
//
// Deploy with JWT verification ON (default) — called by the logged-in frontend.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

async function getFreshAccessToken(admin: any, userId: string): Promise<string | null> {
  const { data: conn, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!conn) return null;

  if (conn.access_token && conn.access_token_expires_at && new Date(conn.access_token_expires_at) > new Date()) {
    return conn.access_token;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token refresh failed: ${await tokenRes.text()}`);

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();
  await admin
    .from("google_calendar_connections")
    .update({ access_token: tokens.access_token, access_token_expires_at: expiresAt })
    .eq("user_id", userId);
  return tokens.access_token;
}

// ---- Free/busy + free-window computation (ported as-is) ----

function getIsraelOffsetMs() {
  const testDate = new Date();
  const ilTimeStr = testDate.toLocaleString("en-US", { timeZone: "Asia/Jerusalem", hour12: false, hour: "numeric" });
  const utcHour = testDate.getUTCHours();
  const ilHour = parseInt(ilTimeStr) % 24;
  let diff = ilHour - utcHour;
  if (diff < 0) diff += 24;
  return diff * 60 * 60 * 1000;
}

function computeFreeWindows(busySlots: Array<{ start: string; end: string }>) {
  const now = new Date();
  const ilOffsetMs = getIsraelOffsetMs();

  const toIlDayStart = (utcMs: number, hour = 0) => {
    const ilMs = utcMs + ilOffsetMs;
    const ilMidnight = ilMs - (ilMs % (24 * 60 * 60 * 1000));
    return ilMidnight - ilOffsetMs + hour * 60 * 60 * 1000;
  };
  const getIlDateKey = (utcMs: number) => {
    const ilMs = utcMs + ilOffsetMs;
    const d = new Date(ilMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };

  const busyPairs = busySlots.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));

  const freeWindows: Array<{ start: string; end: string; durationMins: number }> = [];
  for (let d = 0; d < 7; d++) {
    const dayUtcMs = now.getTime() + d * 24 * 60 * 60 * 1000;
    const dayKey = getIlDateKey(dayUtcMs);
    const dayStartMs = toIlDayStart(dayUtcMs, 9);
    const dayEndMs = toIlDayStart(dayUtcMs, 23);

    let cursorMs: number;
    if (d === 0) {
      const mins = now.getMinutes();
      const rounded = new Date(now);
      if (mins > 0 && mins <= 30) rounded.setMinutes(30, 0, 0);
      else if (mins > 30) rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
      cursorMs = Math.max(rounded.getTime(), dayStartMs);
    } else {
      cursorMs = dayStartMs;
    }
    if (cursorMs >= dayEndMs) continue;

    const dayBusy = busyPairs
      .filter((b) => getIlDateKey(b.start) === dayKey || getIlDateKey(b.end - 1) === dayKey)
      .sort((a, b) => a.start - b.start);

    for (const busy of dayBusy) {
      if (busy.start > cursorMs) {
        const gapMins = (busy.start - cursorMs) / 60000;
        if (gapMins >= 30) {
          freeWindows.push({ start: new Date(cursorMs).toISOString(), end: new Date(busy.start).toISOString(), durationMins: Math.floor(gapMins) });
        }
      }
      if (busy.end > cursorMs) cursorMs = busy.end;
    }
    if (cursorMs < dayEndMs) {
      const gapMins = (dayEndMs - cursorMs) / 60000;
      if (gapMins >= 30) {
        freeWindows.push({ start: new Date(cursorMs).toISOString(), end: new Date(dayEndMs).toISOString(), durationMins: Math.floor(gapMins) });
      }
    }
  }
  return { freeWindows, ilOffsetMs };
}

// ---- Deterministic slot ranking (replaces the original AI call — see file header) ----

function preferredWindow(priority: string) {
  if (priority === "high") return { startHour: 8, endHour: 12, reason: "בוקר – זמן פוקוס גבוה למשימה דחופה" };
  if (priority === "low") return { startHour: 17, endHour: 22, reason: "ערב – מתאים למשימה שיכולה להמתין" };
  return { startHour: 13, endHour: 17, reason: "אחר הצהריים – קצב עבודה רגיל" };
}

function rankSlotsForTask(
  task: { priority: string; estimated_hours?: number },
  freeWindows: Array<{ start: string; end: string; durationMins: number }>,
  ilOffsetMs: number
) {
  const pref = preferredWindow(task.priority);
  const neededMins = Math.round((task.estimated_hours || 1) * 60);

  const scored = freeWindows
    .filter((w) => w.durationMins >= Math.min(neededMins, 30))
    .map((w) => {
      const localHour = new Date(new Date(w.start).getTime() + ilOffsetMs).getUTCHours();
      const inWindow = localHour >= pref.startHour && localHour < pref.endHour;
      return { slot: w, inWindow, startMs: new Date(w.start).getTime() };
    })
    .sort((a, b) => (a.inWindow !== b.inWindow ? (a.inWindow ? -1 : 1) : a.startMs - b.startMs));

  return scored.slice(0, 3).map((s) => ({
    slot: s.slot,
    reason: s.inWindow ? pref.reason : "חלון פנוי (מחוץ לשעות המועדפות)",
  }));
}

// ---- Google Calendar REST calls ----

async function createEvent(
  accessToken: string,
  opts: { summary: string; description: string; start: string; end: string; colorId: string; reminders?: unknown }
) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.start, timeZone: "Asia/Jerusalem" },
      end: { dateTime: opts.end, timeZone: "Asia/Jerusalem" },
      colorId: opts.colorId,
      ...(opts.reminders ? { reminders: opts.reminders } : {}),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, tasks, slot, note } = body;

    if (action === "disconnect") {
      await admin.from("google_calendar_connections").delete().eq("user_id", userId);
      return json({ success: true });
    }

    const accessToken = await getFreshAccessToken(admin, userId);
    if (!accessToken) return json({ error: "not_connected" }, 409);

    if (action === "get_free_slots") {
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: now.toISOString(),
          timeMax: weekLater.toISOString(),
          timeZone: "Asia/Jerusalem",
          items: [{ id: "primary" }],
        }),
      });
      if (!freeBusyRes.ok) return json({ error: await freeBusyRes.text() }, 500);

      const freeBusyData = await freeBusyRes.json();
      const busySlots = freeBusyData.calendars?.primary?.busy || [];
      const { freeWindows, ilOffsetMs } = computeFreeWindows(busySlots);

      const assignments = (tasks || [])
        .map((t: any) => ({ task_title: t.title, slot_options: rankSlotsForTask(t, freeWindows, ilOffsetMs) }))
        .filter((a: any) => a.slot_options.length > 0);

      return json({ freeWindows, assignments });
    }

    if (action === "book_slot") {
      const { taskTitle, start, end, taskId } = slot;
      const event = await createEvent(accessToken, {
        summary: `✅ ${taskTitle}`,
        description: "שובץ על ידי באניק 🧠",
        start,
        end,
        colorId: "9",
      });
      if (taskId) {
        await admin.from("tasks").update({ calendar_event_id: event.id }).eq("id", taskId).eq("user_id", userId);
      }
      return json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    if (action === "book_subtask_slot") {
      const { title, start, end, parentTaskTitle } = slot;
      const event = await createEvent(accessToken, {
        summary: `📌 ${title}`,
        description: `תת-משימה של: ${parentTaskTitle || ""}\nשובץ על ידי באניק 🧠`,
        start,
        end,
        colorId: "6",
      });
      return json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    if (action === "book_note_reminder") {
      const src = slot || note;
      const { content, type, start, end } = src;
      const isTask = type === "task";
      const event = await createEvent(accessToken, {
        summary: isTask ? `✅ ${content}` : `🔔 ${content}`,
        description: isTask ? "משימה מפתקיות באניק 📝" : "תזכורת מפתקיות באניק 📝",
        start,
        end,
        colorId: isTask ? "9" : "6",
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
      });
      return json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
