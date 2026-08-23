import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createLocalMockClient } from './localMockClient';
import { createSupabaseBackedClient } from './supabaseClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
const hasBase44 = Boolean(appId && appBaseUrl);

// Which backend is actually wired up, in priority order:
// a real Supabase project > a real Base44 backend > a localStorage-only mock.
export const backendMode = hasSupabase ? 'supabase' : hasBase44 ? 'base44' : 'local';
export const isLocalMode = backendMode === 'local';

if (isLocalMode && typeof window !== 'undefined') {
  console.info(
    '[banik] No backend configured (Supabase or Base44) — running in local mode. ' +
    'Data (areas, tasks, notes) is stored only in this browser via localStorage.'
  );
}

export const base44 =
  backendMode === 'supabase'
    ? createSupabaseBackedClient()
    : backendMode === 'base44'
      ? createClient({
          appId,
          token,
          functionsVersion,
          serverUrl: '',
          requiresAuth: false,
          appBaseUrl
        })
      : createLocalMockClient();
