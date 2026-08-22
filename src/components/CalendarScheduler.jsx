import { useState } from "react";
import { CalendarDays, Sparkles, Check, Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function CalendarScheduler({ tasks }) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [bookingKey, setBookingKey] = useState(null); // "taskIdx-optionIdx"
  const [booked, setBooked] = useState({}); // taskIdx -> { link }
  const [error, setError] = useState(null);

  const pendingWithHours = tasks.filter((t) => !t.is_completed);

  const handleGetPlan = async () => {
    setLoading(true);
    setAssignments(null);
    setBooked({});
    setExpandedTask(null);
    setError(null);
    const res = await base44.functions.invoke("calendarScheduler", {
      action: "get_free_slots",
      tasks: pendingWithHours,
    });
    if (res.data?.assignments) {
      setAssignments(res.data.assignments);
      if (res.data.assignments.length > 0) setExpandedTask(0);
    } else {
      setError("לא הצלחתי לקבל מידע מהיומן. נסה שוב.");
    }
    setLoading(false);
  };

  const handleBook = async (assignment, taskIdx, option, optionIdx) => {
    const key = `${taskIdx}-${optionIdx}`;
    setBookingKey(key);
    const task = tasks.find((t) => t.title === assignment.task_title);
    const hours = task?.estimated_hours || 1;
    const start = new Date(option.slot.start);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    const slotEnd = new Date(option.slot.end);
    const finalEnd = end < slotEnd ? end : slotEnd;

    const res = await base44.functions.invoke("calendarScheduler", {
      action: "book_slot",
      slot: {
        taskTitle: assignment.task_title,
        start: start.toISOString(),
        end: finalEnd.toISOString(),
        taskId: task?.id,
      },
    });
    if (res.data?.success) {
      setBooked((prev) => ({ ...prev, [taskIdx]: { link: res.data.eventLink } }));
    }
    setBookingKey(null);
  };

  const formatSlotTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return (
      d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" }) +
      " " +
      d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          שיבוץ חכם ביומן Google
        </h2>
        <Button
          size="sm"
          onClick={handleGetPlan}
          disabled={loading || pendingWithHours.length === 0}
          className="text-xs"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 ml-1" />
          )}
          {loading ? "מנתח יומן..." : "הצע שיבוץ"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/5 p-3 rounded-lg">{error}</p>
      )}

      {!assignments && !loading && (
        <p className="text-sm text-muted-foreground italic">
          באניק יבדוק את החלונות הפנויים ביומן Google שלך ויציע לכל משימה מספר אפשרויות שיבוץ עם שיקול דעת לפי אופי המשימה ושעות עדיפות.
        </p>
      )}

      {assignments && assignments.length === 0 && (
        <p className="text-sm text-muted-foreground">לא נמצאו חלונות פנויים מתאימים בשבוע הקרוב.</p>
      )}

      {assignments && assignments.length > 0 && (
        <div className="space-y-2 mt-2">
          {assignments.map((a, taskIdx) => (
            <div
              key={taskIdx}
              className={`border rounded-lg overflow-hidden transition-all ${
                booked[taskIdx] ? "border-green-300 bg-green-50" : "border-border"
              }`}
            >
              {/* Task header row */}
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-secondary/40 transition-colors text-right"
                onClick={() => setExpandedTask(expandedTask === taskIdx ? null : taskIdx)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">{a.task_title}</span>
                  {booked[taskIdx] && (
                    <span className="text-xs text-green-700 font-medium flex items-center gap-1 flex-shrink-0">
                      <Check className="w-3.5 h-3.5" /> שובץ!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {booked[taskIdx] && (
                    <a
                      href={booked[taskIdx].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:opacity-70"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground">{a.slot_options.length} אפשרויות</span>
                  {expandedTask === taskIdx ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Options */}
              {expandedTask === taskIdx && !booked[taskIdx] && (
                <div className="border-t border-border bg-secondary/20 divide-y divide-border">
                  {a.slot_options.map((option, optionIdx) => {
                    const key = `${taskIdx}-${optionIdx}`;
                    return (
                      <div key={optionIdx} className="flex items-center justify-between px-3 py-2.5 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-primary flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {formatSlotTime(option.slot?.start)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.reason}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={optionIdx === 0 ? "default" : "outline"}
                          className="text-xs h-7 flex-shrink-0"
                          disabled={bookingKey === key}
                          onClick={() => handleBook(a, taskIdx, option, optionIdx)}
                        >
                          {bookingKey === key ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : optionIdx === 0 ? (
                            "✅ הכי מומלץ"
                          ) : (
                            "אשר"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}