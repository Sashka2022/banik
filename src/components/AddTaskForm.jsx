import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGoogleCalendarLink } from "@/lib/utils";
import { CalendarDays, Check } from "lucide-react";

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave({
      title: title.trim(),
      due_date: dueDate,
      priority,
      area_id: areaId,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
    });
    setSavedTask({ title: title.trim(), dueDate });
  };

  const calendarLink = savedTask
    ? createGoogleCalendarLink({ title: `משימה: ${savedTask.title}`, dueDate: savedTask.dueDate })
    : null;

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
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-foreground">המשימה נשמרה!</span>
          </div>
          <div className="flex gap-2">
            {calendarLink && (
              <a href={calendarLink} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> הוסף ליומן Google
                </Button>
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={onCancel}>סיום</Button>
          </div>
        </div>
      )}
    </div>
  );
}
