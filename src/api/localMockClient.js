// Local stand-in for the Base44 SDK client.
// Used when no backend (Supabase or Base44) is configured, so the app is
// still fully usable on this machine. All data lives in this browser's
// localStorage — nothing is synced anywhere or across devices.

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
    agents: {
      getWhatsAppConnectURL() {
        return "#";
      },
    },
  };
}
