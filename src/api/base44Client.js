import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createLocalMockClient } from './localMockClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// No Base44 App ID/backend URL configured -> run fully locally against a
// localStorage-backed mock instead of a real Base44 backend.
export const isLocalMode = !appId || !appBaseUrl;

if (isLocalMode && typeof window !== 'undefined') {
  console.info(
    '[banik] No VITE_BASE44_APP_ID / VITE_BASE44_APP_BASE_URL configured — running in local mode. ' +
    'Data (areas, tasks, notes) is stored only in this browser via localStorage.'
  );
}

//Create a client with authentication required
export const base44 = isLocalMode
  ? createLocalMockClient()
  : createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl
    });
