// Local stand-in for the Base44 SDK client.
// Used when no VITE_BASE44_APP_ID / VITE_BASE44_APP_BASE_URL is configured, so the
// app is fully usable on this machine without a Base44 account. All data lives in
// this browser's localStorage — nothing is synced anywhere.

const STORAGE_PREFIX = "banik_local_";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readStore(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(key, items) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(items));
}

function createEntityStore(key, defaults = {}) {
  let items = readStore(key);
  const listeners = new Set();
  const emit = (event) => listeners.forEach((cb) => cb(event));
  const persist = () => writeStore(key, items);

  return {
    async list(sort) {
      const result = [...items];
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        result.sort((a, b) => {
          const av = a[field] ?? "";
          const bv = b[field] ?? "";
          if (av < bv) return desc ? 1 : -1;
          if (av > bv) return desc ? -1 : 1;
          return 0;
        });
      }
      return result;
    },
    async get(id) {
      return items.find((i) => i.id === id) || null;
    },
    async create(data) {
      const now = new Date().toISOString();
      const record = { ...defaults, ...data, id: uid(), created_date: now, updated_date: now };
      items.push(record);
      persist();
      emit({ type: "create", id: record.id, data: record });
      return record;
    },
    async update(id, updates) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`${key} ${id} not found`);
      items[idx] = { ...items[idx], ...updates, updated_date: new Date().toISOString() };
      persist();
      emit({ type: "update", id, data: items[idx] });
      return items[idx];
    },
    async delete(id) {
      items = items.filter((i) => i.id !== id);
      persist();
      emit({ type: "delete", id });
    },
    async deleteMany(filter = {}) {
      const keys = Object.keys(filter);
      const toDelete = items.filter((i) => keys.every((k) => i[k] === filter[k]));
      items = items.filter((i) => !toDelete.includes(i));
      persist();
      toDelete.forEach((i) => emit({ type: "delete", id: i.id }));
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

function makeSlot(daysFromNow, hour, durationMins) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const start = d.toISOString();
  const end = new Date(d.getTime() + durationMins * 60000).toISOString();
  return { start, end, durationMins };
}

async function mockCalendarScheduler(payload = {}) {
  const { action, tasks, note } = payload;

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

  if (action === "book_slot") {
    return { data: { success: true, eventId: uid(), eventLink: "https://calendar.google.com/calendar" } };
  }

  if (action === "book_note_reminder") {
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

async function mockInvokeLLM({ prompt = "", response_json_schema } = {}) {
  // No real AI is wired up in local mode — this returns fixed heuristic
  // placeholders so the UI keeps working, not genuine model output.
  const props = response_json_schema?.properties;

  if (props?.hours) {
    return { hours: 1, explanation: "הערכה גנרית – במצב מקומי אין חיבור ל-AI אמיתי" };
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

  return "תכנית עבודה (מצב מקומי, ללא AI אמיתי): התחל מהמשימות הדחופות ביותר, המשך למשימות הרגילות, ופרק משימות גדולות לתתי-משימות קטנות.";
}

const MOCK_USER = {
  id: "local-user",
  email: "local@banik.app",
  full_name: "משתמש מקומי",
  role: "admin",
};

export function createLocalMockClient() {
  return {
    entities: {
      Area: createEntityStore("areas", { color: "bg-purple-100", sort_order: 0 }),
      Task: createEntityStore("tasks", { priority: "medium", progress: 0, is_completed: false, subtasks: [] }),
      Note: createEntityStore("notes", { color: "bg-yellow-100", is_done: false }),
      User: createEntityStore("users", { role: "user" }),
    },
    auth: {
      async me() {
        return MOCK_USER;
      },
      logout(redirectUrl) {
        if (redirectUrl) window.location.href = redirectUrl;
      },
      redirectToLogin() {
        // No login flow in local mode.
      },
    },
    functions: {
      async invoke(name, payload) {
        if (name === "calendarScheduler") return mockCalendarScheduler(payload);
        return { data: { error: `Function "${name}" is not available in local mode.` } };
      },
    },
    integrations: {
      Core: {
        InvokeLLM: mockInvokeLLM,
      },
    },
    agents: {
      getWhatsAppConnectURL() {
        return "#";
      },
    },
  };
}
