// Real cross-device backend: Postgres tables + Realtime + magic-link auth via
// Supabase. Used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
// See supabase/schema.sql for the table/RLS setup this expects.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// PKCE flow puts the auth code in a query param (?code=...) instead of a
// URL hash fragment, so it doesn't collide with the app's HashRouter routes.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      })
    : null;

function createEntityStore(table, defaults = {}) {
  return {
    async list(sort) {
      let query = supabase.from(table).select("*");
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        query = query.order(field, { ascending: !desc });
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async create(data) {
      const { data: row, error } = await supabase
        .from(table)
        .insert([{ ...defaults, ...data }])
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    async update(id, updates) {
      const { data: row, error } = await supabase
        .from(table)
        .update({ ...updates, updated_date: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    async deleteMany(filter = {}) {
      let query = supabase.from(table).delete();
      const keys = Object.keys(filter);
      if (keys.length === 0) {
        query = query.not("id", "is", null); // delete-all guard: Supabase requires an explicit filter
      } else {
        keys.forEach((k) => {
          query = query.eq(k, filter[k]);
        });
      }
      const { error } = await query;
      if (error) throw error;
    },
    subscribe(cb) {
      let channel = null;
      let unsubscribed = false;

      supabase.auth.getUser().then(({ data }) => {
        const user = data?.user;
        if (!user || unsubscribed) return;
        channel = supabase
          .channel(`${table}-changes-${user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` },
            (payload) => {
              if (payload.eventType === "INSERT") cb({ type: "create", id: payload.new.id, data: payload.new });
              else if (payload.eventType === "UPDATE") cb({ type: "update", id: payload.new.id, data: payload.new });
              else if (payload.eventType === "DELETE") cb({ type: "delete", id: payload.old.id });
            }
          )
          .subscribe();
      });

      return () => {
        unsubscribed = true;
        if (channel) supabase.removeChannel(channel);
      };
    },
  };
}

export function createSupabaseBackedClient() {
  return {
    entities: {
      Area: createEntityStore("areas", { color: "bg-purple-100", sort_order: 0 }),
      Task: createEntityStore("tasks", { priority: "medium", progress: 0, is_completed: false, subtasks: [] }),
      Note: createEntityStore("notes", { color: "bg-yellow-100", is_done: false }),
    },
    auth: {
      async me() {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) throw new Error("Not authenticated");
        return { id: data.user.id, email: data.user.email, full_name: data.user.email, role: "admin" };
      },
      async logout(redirectUrl) {
        await supabase.auth.signOut();
        if (redirectUrl) window.location.href = redirectUrl;
      },
      redirectToLogin() {
        // No-op: the app renders a <Login/> screen instead of redirecting externally.
      },
      async sendMagicLink(email) {
        const redirectTo = window.location.origin + import.meta.env.BASE_URL;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
      },
    },
    agents: {
      getWhatsAppConnectURL() {
        return "#";
      },
    },
  };
}
