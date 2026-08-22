import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { CalendarDays, Loader2, Check, ExternalLink } from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: "high", label: "דחוף", emoji: "🔴", bg: "bg-red-100 border-red-400 text-red-800", activeBg: "ring-2 ring-red-500" },
  { value: "medium", label: "רגיל", emoji: "🟡", bg: "bg-yellow-100 border-yellow-400 text-yellow-800", activeBg: "ring-2 ring-yellow-500" },
  { value: "low", label: "יכול להמתין", emoji: "🟢", bg: "bg-green-100 border-green-400 text-green-800", activeBg: "ring-2 ring-green-500" },
];

export default function AddTaskForm({ areaId, onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [savedTask, setSavedTask] = useState(null);

  // Calendar scheduling state
  const [calLoading, setCalLoading] = useState(false);
  const [calSlots, setCalSlots] = useState(null);
  const [bookingIdx, setBookingIdx] = useState(null);
  const [booked, setBooked] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const task = await onSave({
      title: title.trim(),
      due_date: dueDate,
      priority,
      area_id: areaId,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
    });
    setSavedTask({ title: title.trim(), priority, estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 1 });
  };

  const handleGetSlots = async () => {
    if (!savedTask) return;
    setCalLoading(true);
    setCalSlots(null);
    setBooked(null);
    try {
      const res = await base44.functions.invoke("calendarScheduler", {
        action: "get_free_slots",
        tasks: [savedTask],
      });
      if (res.data?.error) {
        setCalSlots([]);
      } else {
        const assignment = res.data?.assignments?.[0];
        if (assignment?.slot_options?.length > 0) {
          setCalSlots(assignment.slot_options);
        } else if (res.data?.freeWindows?.length > 0) {
          setCalSlots(res.data.freeWindows.slice(0, 6).map(s => ({ slot: s, reason: "" })));
        } else {
          setCalSlots([]);
        }
      }
    } catch (err) {
      setCalSlots([]);
    }
    setCalLoading(false);
  };

  const handleBook = async (option, idx) => {
    setBookingIdx(idx);
    const slot = option.slot || option;
    const hours = savedTask?.estimated_hours || 1;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    const slotEnd = new Date(slot.end);
    const finalEnd = end < slotEnd ? end : slotEnd;

    const res = await base44.functions.invoke("calendarScheduler", {
      action: "book_slot",
      slot: {
        taskTitle: savedTask.title,
        start: start.toISOString(),
        end: finalEnd.toISOString(),
      },
    });
    if (res.data?.success) {
      setBooked({ idx, link: res.data.eventLink });
    }
    setBookingIdx(null);
  };

  const formatSlot = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" }) +
      " " + d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-card p-4 rounded-lg border-2 border-primary/20 shadow-sm animate-fade-in-up" dir="rtl">
      {!savedTask ? (
        <form onSubmit={handleSubmit}>
          <Input
            autoFocus
            required
            placeholder="מה המשימה?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-3 text-right"
          />
          {/* Traffic Light Priority */}
          <div className="flex gap-2 mb-3">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${opt.bg} ${priority === opt.value ? opt.activeBg + " scale-105 shadow-sm" : "opacity-60"}`}
              >
                <div className="text-lg mb-0.5">{opt.emoji}</div>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              type="date"
              className="flex-1 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              type="number"
              min="0.25"
              step="0.25"
              placeholder="שעות משוערות"
              className="flex-1 text-sm text-right"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>ביטול</Button>
            <Button type="submit" size="sm">שמור משימה</Button>
          </div>
        </form>
      ) : (
        /* After save — offer calendar scheduling */
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-foreground">המשימה נשמרה! רוצה לשבץ אותה ביומן?</span>
          </div>

          {!calSlots && !calLoading && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleGetSlots} className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> שבץ חכם ביומן Google
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>סיום</Button>
            </div>
          )}

          {calLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              באניק בודק חלונות פנויים ביומן...
            </div>
          )}

          {calSlots !== null && !calLoading && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">בחר חלון פנוי לשיבוץ:</p>
              {calSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">לא נמצאו חלונות פנויים בשבוע הקרוב.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {calSlots.map((option, idx) => {
                    const slot = option.slot || option;
                    return (
                      <div key={idx} className={`p-2 rounded-lg border transition-all ${booked?.idx === idx ? "border-green-300 bg-green-50" : "border-border bg-secondary/30"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground text-xs font-medium">{formatSlot(slot.start)} <span className="text-muted-foreground">({slot.durationMins} דק׳)</span></span>
                            {option.reason && <div className="text-xs text-muted-foreground mt-0.5">{option.reason}</div>}
                          </div>
                          {booked?.idx === idx ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-green-700 font-medium">שובץ! ✅</span>
                              <a href={booked.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 text-primary" /></a>
                            </div>
                          ) : (
                            <Button size="sm" variant={idx === 0 ? "default" : "outline"} className="h-6 text-xs px-2 flex-shrink-0" disabled={bookingIdx === idx || booked !== null} onClick={() => handleBook(option, idx)}>
                              {bookingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : idx === 0 ? "✅ מומלץ" : "אשר"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={onCancel}>סיום</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}