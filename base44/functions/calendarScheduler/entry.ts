import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { action, tasks, slot } = body;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    if (action === 'get_free_slots') {
      // Fetch events for the next 7 days to find free slots
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const freeBusyRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          timeMin: now.toISOString(),
          timeMax: weekLater.toISOString(),
          timeZone: 'Asia/Jerusalem',
          items: [{ id: 'primary' }],
        }),
      });

      if (!freeBusyRes.ok) {
        const err = await freeBusyRes.text();
        return Response.json({ error: err }, { status: 500 });
      }

      const freeBusyData = await freeBusyRes.json();
      const busySlots = freeBusyData.calendars?.primary?.busy || [];


      // Helper: get Israel UTC offset in ms by checking current DST
      // Israel is UTC+2 in winter, UTC+3 in summer (DST)
      const getIsraelOffsetMs = () => {
        const testDate = new Date();
        const ilTimeStr = testDate.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour12: false, hour: 'numeric' });
        const utcHour = testDate.getUTCHours();
        const ilHour = parseInt(ilTimeStr) % 24;
        let diff = ilHour - utcHour;
        if (diff < 0) diff += 24;
        return diff * 60 * 60 * 1000;
      };

      const ilOffsetMs = getIsraelOffsetMs();

      // Convert UTC timestamp to Israel local midnight (start of day) in UTC ms
      const toIlDayStart = (utcMs, hour = 0) => {
        // Shift to IL time, floor to midnight, shift back
        const ilMs = utcMs + ilOffsetMs;
        const ilMidnight = ilMs - (ilMs % (24 * 60 * 60 * 1000));
        return ilMidnight - ilOffsetMs + hour * 60 * 60 * 1000;
      };

      const getIlDateKey = (utcMs) => {
        // Returns "YYYY-MM-DD" in IL time
        const ilMs = utcMs + ilOffsetMs;
        const d = new Date(ilMs);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      };

      // Convert all busy slots to UTC ms pairs
      const busyPairs = busySlots.map(b => ({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
      }));

      // Build free windows per day
      const freeWindows = [];
      for (let d = 0; d < 7; d++) {
        const dayUtcMs = now.getTime() + d * 24 * 60 * 60 * 1000;
        const dayKey = getIlDateKey(dayUtcMs);

        const dayStartMs = toIlDayStart(dayUtcMs, 9);  // 9am Israel
        const dayEndMs   = toIlDayStart(dayUtcMs, 23); // 11pm Israel

        // For today: start from now rounded up to next 30min, but at least 9am
        let cursorMs;
        if (d === 0) {
          const mins = now.getMinutes();
          let rounded = new Date(now);
          if (mins === 0) {
            // on the hour
          } else if (mins <= 30) {
            rounded.setMinutes(30, 0, 0);
          } else {
            rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
          }
          cursorMs = Math.max(rounded.getTime(), dayStartMs);
        } else {
          cursorMs = dayStartMs;
        }

        if (cursorMs >= dayEndMs) continue;

        // Get busy slots for this IL day
        const dayBusy = busyPairs
          .filter(b => getIlDateKey(b.start) === dayKey || getIlDateKey(b.end - 1) === dayKey)
          .sort((a, b) => a.start - b.start);

        // Find free gaps of at least 30 min
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

      // Ask AI to suggest task-slot pairings
      const taskList = tasks.map(t => `- "${t.title}" (${t.priority === 'high' ? 'דחוף' : t.priority === 'medium' ? 'רגיל' : 'יכול להמתין'}, ~${t.estimated_hours || 1}ש')`).join('\n');
      const slotsToUse = freeWindows.slice(0, 15);
      const slotList = slotsToUse.map((s, i) => {
        // Display times in Israel local time
        const startMs = new Date(s.start).getTime() + ilOffsetMs;
        const endMs   = new Date(s.end).getTime() + ilOffsetMs;
        const sd = new Date(startMs);
        const ed = new Date(endMs);
        const days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
        const dayName = days[sd.getUTCDay()];
        const fmt = (d) => `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
        const dateStr = `${sd.getUTCDate()}/${sd.getUTCMonth()+1}`;
        return `[${i}] יום ${dayName} ${dateStr}: ${fmt(sd)}-${fmt(ed)} (${s.durationMins} דק)`;
      }).join('\n');

      const aiRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `אתה עוזר חכם בשם "באניק". להלן רשימת המשימות ורשימת החלונות הפנויים ביומן.

כללי שיקול דעת:
- משימות דחופות מועדפות לשעות הבוקר (8:00-12:00) – שעות עם פוקוס גבוה
- משימות יצירתיות/לימוד – מועדפות בבוקר או אחר-הצהריים המוקדם
- משימות אדמיניסטרטיביות/רגילות – אחה"צ (13:00-17:00)
- משימות קלות/"יכולות להמתין" – שעות הערב (17:00-22:00)
- אסור לשבץ משימות אחרי 23:00
- אסור לשבץ משימות בשעות לפני 8:00
- לכל משימה הצע 2-3 אפשרויות שיבוץ שונות (slot_options) מתוך החלונות הפנויים, ממוינות מהעדיפה לפחות עדיפה

משימות:
${taskList}

חלונות פנויים (מספר: תיאור):
${slotList}

החזר JSON עם assignments – מערך אובייקטים, כל אחד עם:
- task_title (string)
- slot_options: מערך של עד 3 אובייקטים, כל אחד עם slot_index (number) ו-reason (string קצרה בעברית המסבירה למה הזמן הזה מתאים)`,
        response_json_schema: {
          type: 'object',
          properties: {
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task_title: { type: 'string' },
                  slot_options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        slot_index: { type: 'number' },
                        reason: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Merge AI suggestions with actual slot data
      const assignments = (aiRes?.assignments || []).map(a => {
        const options = (a.slot_options || [])
          .filter(opt => typeof opt.slot_index === 'number' && opt.slot_index >= 0 && opt.slot_index < slotsToUse.length)
          .map(opt => ({
            slot: slotsToUse[opt.slot_index],
            reason: opt.reason,
          }));
        // If AI returned no valid options, fallback: pick first 3 slots
        if (options.length === 0) {
          return {
            task_title: a.task_title,
            slot_options: slotsToUse.slice(0, 3).map(s => ({ slot: s, reason: 'חלון פנוי זמין' })),
          };
        }
        return { task_title: a.task_title, slot_options: options };
      }).filter(a => a.slot_options.length > 0);

      return Response.json({ freeWindows: slotsToUse, assignments });
    }

    if (action === 'book_slot') {
      // Create a calendar event for this slot
      const { taskTitle, start, end, taskId } = slot;
      const eventBody = {
        summary: `✅ ${taskTitle}`,
        description: 'שובץ על ידי באניק 🧠',
        start: { dateTime: start, timeZone: 'Asia/Jerusalem' },
        end: { dateTime: end, timeZone: 'Asia/Jerusalem' },
        colorId: '9', // blueberry
      };

      const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(eventBody),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        return Response.json({ error: err }, { status: 500 });
      }

      const event = await createRes.json();

      // Mark task as having a calendar event
      if (taskId) {
        await base44.asServiceRole.entities.Task.update(taskId, { calendar_event_id: event.id });
      }

      return Response.json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    if (action === 'book_subtask_slot') {
      // Book a calendar event for a subtask with manual date/time
      const { title, start, end, parentTaskTitle } = slot;
      const eventBody = {
        summary: `📌 ${title}`,
        description: `תת-משימה של: ${parentTaskTitle || ''}\nשובץ על ידי באניק 🧠`,
        start: { dateTime: start, timeZone: 'Asia/Jerusalem' },
        end: { dateTime: end, timeZone: 'Asia/Jerusalem' },
        colorId: '6', // tangerine
      };

      const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(eventBody),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        return Response.json({ error: err }, { status: 500 });
      }

      const event = await createRes.json();
      return Response.json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    if (action === 'book_note_reminder') {
      const { content, noteId, type, start, end } = slot || body.note;
      // For Google Tasks, we create a special calendar event styled as a task/reminder
      const isTask = type === 'task';
      const eventBody = {
        summary: isTask ? `✅ ${content}` : `🔔 ${content}`,
        description: isTask ? 'משימה מפתקיות באניק 📝' : 'תזכורת מפתקיות באניק 📝',
        start: { dateTime: start, timeZone: 'Asia/Jerusalem' },
        end: { dateTime: end, timeZone: 'Asia/Jerusalem' },
        colorId: isTask ? '9' : '6', // blueberry for task, tangerine for reminder
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(eventBody),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        return Response.json({ error: err }, { status: 500 });
      }

      const event = await createRes.json();
      return Response.json({ success: true, eventId: event.id, eventLink: event.htmlLink });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});