// Calendar scheduling and "AI" heuristics shared by every backend mode that
// doesn't have a real calendar/LLM integration wired up (local mode and the
// Supabase mode both use these — neither has a real Google Calendar or LLM
// connection behind it).

export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function makeSlot(daysFromNow, hour, durationMins) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const start = d.toISOString();
  const end = new Date(d.getTime() + durationMins * 60000).toISOString();
  return { start, end, durationMins };
}

export async function mockCalendarScheduler(payload = {}) {
  const { action, tasks } = payload;

  if (action === "get_free_slots") {
    const assignments = (tasks || []).map((t) => {
      const mins = Math.round((t.estimated_hours || 1) * 60);
      return {
        task_title: t.title,
        slot_options: [
          { slot: makeSlot(1, 9, mins), reason: 'בוקר מחר – זמן שקט לריכוז (הצעה מקומית, ללא חיבור אמיתי ליומן)' },
          { slot: makeSlot(2, 14, mins), reason: 'אחה"צ בעוד יומיים – חלון פנוי משוער' },
          { slot: makeSlot(3, 16, mins), reason: "לקראת סוף השבוע" },
        ],
      };
    });
    return { data: { assignments } };
  }

  if (action === "book_slot" || action === "book_note_reminder") {
    return { data: { success: true, eventId: uid(), eventLink: "https://calendar.google.com/calendar" } };
  }

  return { data: { error: `Unknown calendarScheduler action: ${action}` } };
}

const MOTIVATIONS = [
  "צעד קטן היום שווה יותר מתכנון מושלם מחר – באניק",
  "אתה כבר בפנים, רק תמשיך לזוז – באניק",
  "משימה אחת בכל פעם, וזה כבר מתקדם – באניק",
  "לא צריך מוטיבציה כדי להתחיל, רק להתחיל – באניק",
];

export async function mockInvokeLLM({ prompt = "", response_json_schema } = {}) {
  // No real AI is wired up — this returns fixed heuristic placeholders so
  // the UI keeps working, not genuine model output.
  const props = response_json_schema?.properties;

  if (props?.hours) {
    return { hours: 1, explanation: "הערכה גנרית – אין חיבור ל-AI אמיתי" };
  }

  if (props?.subtasks) {
    return {
      subtasks: [
        { title: "תכנון ואיסוף מידע", estimatedHours: 0.5 },
        { title: "ביצוע עיקרי", estimatedHours: 1 },
        { title: "בדיקה וסיום", estimatedHours: 0.5 },
      ],
    };
  }

  if (prompt.includes("מוטיבציה")) {
    return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
  }

  return "תכנית עבודה (ללא AI אמיתי): התחל מהמשימות הדחופות ביותר, המשך למשימות הרגילות, ופרק משימות גדולות לתתי-משימות קטנות.";
}
