import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, AlertTriangle, Clock, CheckCircle, Sparkles, Loader2, TrendingDown, CalendarDays, MessageCircle, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import CalendarScheduler from "../components/CalendarScheduler";
import UrgentTasksAlert from "../components/UrgentTasksAlert";
import NotesSection from "../components/NotesSection";
import AdminPanel from "../components/AdminPanel";
import GoogleCalendarConnect from "../components/GoogleCalendarConnect";

const PRIORITY_CONFIG = {
  high: { label: "דחוף 🔴", color: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  medium: { label: "רגיל 🟡", color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
  low: { label: "יכול להמתין 🟢", color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
};

export default function Dashboard() {
  const [areas, setAreas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedPriority, setExpandedPriority] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [fetchedAreas, fetchedTasks] = await Promise.all([
        base44.entities.Area.list("created_date"),
        base44.entities.Task.list("-created_date"),
      ]);
      setAreas(fetchedAreas);
      setTasks(fetchedTasks);
      setLoading(false);
    };
    load();
  }, []);

  const pending = tasks.filter((t) => !t.is_completed);
  const highCount = pending.filter((t) => t.priority === "high").length;
  const mediumCount = pending.filter((t) => t.priority === "medium").length;
  const lowCount = pending.filter((t) => t.priority === "low").length;

  // Area neglect = lowest progress among areas with tasks
  const areaStats = areas.map((area) => {
    const areaTasks = tasks.filter((t) => t.area_id === area.id);
    if (areaTasks.length === 0) return { ...area, progress: null, pendingCount: 0 };
    const totalProgress = areaTasks.reduce((sum, t) => {
      if (t.is_completed) return sum + 100;
      return sum + (t.progress || 0);
    }, 0);
    const avg = Math.round(totalProgress / areaTasks.length);
    const pendingCount = areaTasks.filter((t) => !t.is_completed).length;
    return { ...area, progress: avg, pendingCount };
  }).filter((a) => a.progress !== null);

  const neglectedArea = [...areaStats].sort((a, b) => a.progress - b.progress)[0];

  const handleAIPlan = async () => {
    setAiLoading(true);
    const taskSummary = pending.slice(0, 20).map((t) => {
      const area = areas.find((a) => a.id === t.area_id);
      return `- "${t.title}" (עדיפות: ${t.priority === "high" ? "דחוף" : t.priority === "medium" ? "רגיל" : "יכול להמתין"}, תחום: ${area?.name || "כללי"}, התקדמות: ${t.progress || 0}%${t.estimated_hours ? `, זמן משוער: ${t.estimated_hours}ש'` : ""})`;
    }).join("\n");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `אתה עוזר חכם בשם "באניק". להלן רשימת המשימות הפתוחות של המשתמש:\n${taskSummary}\n\nהצע תכנית עבודה קצרה וברורה: ממה כדאי להתחיל קודם ולמה. כתוב 3-5 נקודות פעולה עם סדר עדיפויות ברור. היה ידידותי, מעשי ותמציתי.`,
    });
    setAiPlan(result);
    setAiLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-rubik" dir="rtl">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-black text-primary">דשבורד | באניק</h1>
          <div className="mr-auto flex items-center gap-2">
            <a
              href="https://calendar.google.com/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5" /> היומן שלי
            </a>
            <a
              href={base44.agents.getWhatsAppConnectURL('bannik_agent')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-medium border border-green-200 hover:bg-green-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <button
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-1.5 text-xs bg-foreground text-background px-3 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity"
              title="פאנל אדמין"
            >
              <Shield className="w-3.5 h-3.5" /> אדמין
            </button>
          </div>
        </div>
      </header>

      {showAdmin && (
        <AdminPanel
          areas={areas}
          tasks={tasks}
          onClose={() => setShowAdmin(false)}
          onChanged={async () => {
            const [a, t] = await Promise.all([
              base44.entities.Area.list("created_date"),
              base44.entities.Task.list("-created_date"),
            ]);
            setAreas(a);
            setTasks(t);
          }}
        />
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 pb-20">
        <GoogleCalendarConnect />
        <UrgentTasksAlert tasks={tasks} />
        {/* Priority Summary */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-muted-foreground mb-3">סיכום משימות פתוחות</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "high", count: highCount, icon: <AlertTriangle className="w-5 h-5 text-red-500" />, label: "דחוף", bg: "bg-red-50 border-red-200", activeBg: "bg-red-100 border-red-400 ring-2 ring-red-300" },
              { key: "medium", count: mediumCount, icon: <Clock className="w-5 h-5 text-yellow-500" />, label: "רגיל", bg: "bg-yellow-50 border-yellow-200", activeBg: "bg-yellow-100 border-yellow-400 ring-2 ring-yellow-300" },
              { key: "low", count: lowCount, icon: <CheckCircle className="w-5 h-5 text-green-500" />, label: "יכול להמתין", bg: "bg-green-50 border-green-200", activeBg: "bg-green-100 border-green-400 ring-2 ring-green-300" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setExpandedPriority(expandedPriority === item.key ? null : item.key)}
                className={`border rounded-xl p-4 text-center transition-all cursor-pointer w-full ${expandedPriority === item.key ? item.activeBg : item.bg + " hover:opacity-80"}`}
              >
                <div className="flex justify-center mb-2">{item.icon}</div>
                <div className="text-3xl font-black text-foreground">{item.count}</div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">{item.label}</div>
              </button>
            ))}
          </div>

          {expandedPriority && (
            <div className="mt-3 bg-card border border-border rounded-xl overflow-hidden animate-fade-in-up">
              <div className="px-4 py-2.5 border-b border-border bg-secondary/40">
                <span className="text-sm font-semibold text-foreground">
                  משימות {expandedPriority === "high" ? "דחופות 🔴" : expandedPriority === "medium" ? "רגילות 🟡" : "שיכולות להמתין 🟢"}
                </span>
              </div>
              <div className="divide-y divide-border">
                {pending.filter((t) => t.priority === expandedPriority).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic px-4 py-3">אין משימות בקטגוריה זו</p>
                ) : (
                  pending.filter((t) => t.priority === expandedPriority).map((task) => {
                    const area = areas.find((a) => a.id === task.area_id);
                    return (
                      <div key={task.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {area && <span className={`text-xs px-1.5 py-0.5 rounded ${area.color} text-foreground/70`}>{area.name}</span>}
                            {task.due_date && <span className="text-xs text-muted-foreground">📅 {task.due_date}</span>}
                            {task.progress > 0 && <span className="text-xs text-muted-foreground">{task.progress}%</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

        {/* Area Progress */}
        <section className="mb-6">
          <h2 className="text-base font-bold text-muted-foreground mb-3">מצב התחומים</h2>
          <div className="space-y-3">
            {areaStats.sort((a, b) => a.progress - b.progress).map((area) => (
              <div key={area.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${area.color}`} />
                    <span className="font-semibold text-sm text-foreground">{area.name}</span>
                    {neglectedArea?.id === area.id && (
                      <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                        <TrendingDown className="w-3 h-3" /> דורש תשומת לב
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {area.pendingCount} משימות פתוחות
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${area.progress === 100 ? "bg-green-500" : area.progress < 30 ? "bg-red-400" : "bg-primary"}`}
                    style={{ width: `${area.progress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1 text-left">{area.progress}%</div>
              </div>
            ))}
            {areaStats.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">אין תחומים עם משימות עדיין</p>
            )}
          </div>
        </section>

        {/* AI Plan */}
        <section className="mb-6">
          <div className="bg-card border border-accent/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                באניק ממליץ – מאיפה להתחיל?
              </h2>
              <Button
                size="sm"
                onClick={handleAIPlan}
                disabled={aiLoading || pending.length === 0}
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 ml-1" />בקש תכנית</>}
              </Button>
            </div>

            {aiPlan ? (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-line">
                {aiPlan}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {pending.length === 0
                  ? "אין משימות פתוחות כרגע 🎉"
                  : "לחץ על 'בקש תכנית' ובאניק יסתכל על כל המשימות שלך ויציע תכנית עבודה חכמה."}
              </p>
            )}
          </div>
        </section>

        {/* Calendar Scheduler */}
        <section className="mb-6">
          <CalendarScheduler tasks={tasks} />
        </section>

        {/* Notes */}
        <section className="mb-6 bg-card border border-border rounded-xl p-4">
          <NotesSection />
        </section>
      </main>
    </div>
  );
}