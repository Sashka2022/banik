import { useState } from "react";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      await base44.auth.sendMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || "שליחת הקישור נכשלה. נסה שוב.");
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-black text-primary text-center mb-1">באניק 🧠</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          התחברות עם קישור חד-פעמי למייל, כדי שהמידע שלך יסתנכרן בין המכשירים.
        </p>

        {sent ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">שלחנו קישור התחברות ל-{email}</p>
            <p className="text-xs text-muted-foreground">פתח את המייל ולחץ על הקישור כדי להיכנס.</p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-xs text-primary hover:underline"
            >
              שלח שוב / החלף כתובת מייל
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-right"
              dir="ltr"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full flex items-center justify-center gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              שלח קישור התחברות
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
