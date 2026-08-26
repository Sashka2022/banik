import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Check, Loader2, X } from "lucide-react";
import { base44, backendMode } from "@/api/base44Client";

export default function GoogleCalendarConnect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null); // { connected, connectedAt } | null while loading
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'connected' | 'error', message }

  useEffect(() => {
    if (backendMode !== "supabase") return;
    base44.google.getStatus().then(setStatus).catch(() => setStatus({ connected: false }));

    const googleParam = searchParams.get("google");
    if (googleParam) {
      setBanner({ type: googleParam, message: searchParams.get("message") });
      const next = new URLSearchParams(searchParams);
      next.delete("google");
      next.delete("message");
      setSearchParams(next, { replace: true });
      if (googleParam === "connected") {
        base44.google.getStatus().then(setStatus).catch(() => {});
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (backendMode !== "supabase" || status === null) return null;

  const handleConnect = async () => {
    setLoading(true);
    try {
      await base44.google.connect(); // redirects the browser to Google's consent screen
    } catch (err) {
      setBanner({ type: "error", message: err.message });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await base44.google.disconnect();
      setStatus({ connected: false });
    } catch (err) {
      setBanner({ type: "error", message: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      {banner && (
        <div
          className={`flex items-start justify-between gap-2 mb-3 p-3 rounded-lg text-sm ${
            banner.type === "connected" ? "bg-green-50 text-green-800 border border-green-200" : "bg-destructive/5 text-destructive border border-destructive/20"
          }`}
        >
          <span>
            {banner.type === "connected"
              ? "היומן שלך חובר בהצלחה! 🎉"
              : `החיבור ליומן נכשל${banner.message ? `: ${banner.message}` : ""}`}
          </span>
          <button onClick={() => setBanner(null)} className="flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">חיבור ליומן Google</div>
            <div className="text-xs text-muted-foreground">
              {status.connected ? "מחובר — שיבוץ המשימות יוצר אירועים אמיתיים ביומן שלך" : "לא מחובר — שיבוץ משימות משתמש בהצעות הדגמה בלבד"}
            </div>
          </div>
        </div>

        {status.connected ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-full font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
            מחובר — התנתק
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-medium hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
            חבר יומן Google
          </button>
        )}
      </div>
    </div>
  );
}
