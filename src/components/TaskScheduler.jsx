import { useState } from "react";
import { CalendarDays, Loader2, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function TaskScheduler({ task }) {
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState(null); // [{ slot, reason }]
  const [bookingIdx, setBookingIdx] = useState(null);
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState(null);

  const handleGetSlots = async () => {
    setLoading(true);
    setSlots(null);
    setBooked(null);
    setError(null);
    try {
      const res = await base44.functions.invoke("calendarScheduler", {
        action: "get_free_slots",
        tasks: [{
          title: task.title,
          priority: task.priority,
          estimated_hours: task.estimated_hours || 1,
        }],
      });
      if (res.data?.error) {
        setError(`שגיאה: ${res.data.error}`);
        setSlots([]);
      } else {
        const assignment = res.data?.assignments?.[0];
        if (assignment?.slot_options?.length > 0) {
          setSlots(assignment.slot_options);
        } else {
          setSlots([]);
          setError("לא נמצאו חלונות פנויים בשבוע הקרוב.");
        }
      }
    } catch (err) {
      setError(`שגיאה בחיבור לשרת: ${err.message}`);
      setSlots([]);
    }
    setLoading(false);
  };

  const handleBook = async (option, idx) => {
    setBookingIdx(idx);
    const slot = option.slot || option;
    const hours = task.estimated_hours || 1;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    const slotEnd = new Date(slot.end);
    const finalEnd = end < slotEnd ? end : slotEnd;

    const res = await base44.functions.invoke("calendarScheduler", {
      action: "book_slot",
      slot: {
        taskTitle: task.title,
        start: start.toISOString(),
        end: finalEnd.toISOString(),
        taskId: task.id,
      },
    });
    if (res.data?.success) {
      setBooked({ idx, link: res.data.eventLink });
    }
    setBookingIdx(null);
  };

  const formatSlot = (isoStr) => {
    const d = new Date(isoStr);
    return (
      d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" }) +
      " " +
      d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" /> שיבוץ חכם ביומן
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          onClick={handleGetSlots}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : slots ? (
            "שבץ מחדש"
          ) : (
            "מצא חלון פנוי"
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {slots && slots.length > 0 && (
        <div className="space-y-1.5">
          {slots.map((option, idx) => {
            const slot = option.slot || option;
            return (
              <div
                key={idx}
                className={`p-2 rounded-lg border transition-all ${
                  booked?.idx === idx ? "border-green-300 bg-green-50" : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary">{formatSlot(slot.start)}</span>
                    {option.reason && (
                      <div className="text-xs text-muted-foreground mt-0.5">{option.reason}</div>
                    )}
                  </div>
                  {booked?.idx === idx ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> שובץ!
                      </span>
                      <a href={booked.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      </a>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={idx === 0 ? "default" : "outline"}
                      className="h-6 text-xs px-2 flex-shrink-0"
                      disabled={bookingIdx === idx || booked !== null}
                      onClick={() => handleBook(option, idx)}
                    >
                      {bookingIdx === idx ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : idx === 0 ? (
                        "✅ מומלץ"
                      ) : (
                        "אשר"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}