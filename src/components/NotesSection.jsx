import { useState, useEffect } from "react";
import { Plus, Trash2, CalendarCheck, Loader2, ExternalLink, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const NOTE_COLORS = [
  { value: "bg-yellow-100", label: "צהוב" },
  { value: "bg-blue-100", label: "כחול" },
  { value: "bg-green-100", label: "ירוק" },
  { value: "bg-pink-100", label: "ורוד" },
  { value: "bg-purple-100", label: "סגול" },
  { value: "bg-orange-100", label: "כתום" },
];

function ReminderModal({ note, onClose }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("reminder"); // "reminder" | "task"
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const handleBook = async () => {
    if (!date) return;
    setLoading(true);
    const startISO = `${date}T${time}:00`;
    const start = new Date(startISO);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const res = await base44.functions.invoke("calendarScheduler", {
      action: "book_note_reminder",
      note: {
        content: note.content,
        noteId: note.id,
        type,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });

    if (res.data?.success) {
      await base44.entities.Note.update(note.id, {
        calendar_reminder_id: res.data.eventId,
        calendar_reminder_link: res.data.eventLink,
      });
      setDone(res.data.eventLink);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5 relative">
        <button onClick={onClose} className="absolute top-3 left-3 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-base mb-1 text-foreground">שבץ ביומן Google</h3>
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{note.content}</p>

        {done ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-semibold text-green-700 mb-3">שובץ בהצלחה!</p>
            <a
              href={done}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-primary underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> פתח ביומן
            </a>
            <button onClick={onClose} className="mt-3 text-xs text-muted-foreground hover:text-foreground">סגור</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setType("reminder")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${type === "reminder" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
              >
                🔔 תזכורת
              </button>
              <button
                onClick={() => setType("task")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${type === "task" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
              >
                ✅ משימה
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 text-sm border border-input rounded-md px-3 py-2 bg-background outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-24 text-sm border border-input rounded-md px-3 py-2 bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <button
              onClick={handleBook}
              disabled={!date || loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CalendarCheck className="w-4 h-4" /> שבץ</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onDelete }) {
  const [showReminder, setShowReminder] = useState(false);
  const [done, setDone] = useState(note.is_done || false);

  const handleToggle = async () => {
    const newVal = !done;
    setDone(newVal);
    await base44.entities.Note.update(note.id, { is_done: newVal });
  };

  return (
    <>
      {showReminder && <ReminderModal note={note} onClose={() => setShowReminder(false)} />}
      <div className={`${note.color || "bg-yellow-100"} rounded-xl p-3 shadow-sm border border-black/5 flex flex-col gap-2 min-h-[100px] relative group transition-opacity ${done ? "opacity-60" : ""}`}>
        {/* Checkbox row */}
        <div className="flex items-start gap-2">
          <button
            onClick={handleToggle}
            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${done ? "bg-foreground border-foreground" : "border-foreground/40 bg-transparent hover:border-foreground/70"}`}
          >
            {done && (
              <svg className="w-2.5 h-2.5 text-background" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <p className={`text-sm text-foreground whitespace-pre-wrap flex-1 leading-relaxed ${done ? "line-through text-foreground/50" : ""}`}>
            {note.content}
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between">
          {note.calendar_reminder_link ? (
            <a
              href={note.calendar_reminder_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary flex items-center gap-1 hover:underline"
            >
              <CalendarCheck className="w-3 h-3" /> ביומן
            </a>
          ) : (
            <button
              onClick={() => setShowReminder(true)}
              className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
            >
              <CalendarCheck className="w-3 h-3" /> שבץ ביומן
            </button>
          )}
          <button
            onClick={() => onDelete(note.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

function AddNoteForm({ onClose }) {
  const [content, setContent] = useState("");
  const [color, setColor] = useState("bg-yellow-100");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await base44.entities.Note.create({ content: content.trim(), color });
    setSaving(false);
    onClose();
  };

  return (
    <div className={`${color} rounded-xl p-3 border border-black/10 shadow-md animate-fade-in-up`}>
      <textarea
        autoFocus
        placeholder="כתוב פתק חופשי..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full bg-transparent text-sm text-foreground resize-none outline-none min-h-[80px] placeholder:text-foreground/50"
      />
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${c.value} ${color === c.value ? "border-foreground/60 scale-110" : "border-transparent"}`}
              title={c.label}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">ביטול</button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="text-xs bg-foreground text-background px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotesSection() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    base44.entities.Note.list("-created_date").then((data) => {
      setNotes(data);
      setLoading(false);
    });

    const unsub = base44.entities.Note.subscribe((event) => {
      if (event.type === "create") setNotes((prev) => [event.data, ...prev]);
      else if (event.type === "update") setNotes((prev) => prev.map((n) => (n.id === event.id ? event.data : n)));
      else if (event.type === "delete") setNotes((prev) => prev.filter((n) => n.id !== event.id));
    });

    return unsub;
  }, []);

  const handleDelete = async (id) => {
    await base44.entities.Note.delete(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-muted-foreground flex items-center gap-2">
          📝 פתקיות
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-primary border border-dashed border-primary/40 px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> פתק חדש
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : (
        <div className="columns-2 gap-3 space-y-3">
          {adding && (
            <div className="break-inside-avoid mb-3">
              <AddNoteForm onClose={() => setAdding(false)} />
            </div>
          )}
          {notes.map((note) => (
            <div key={note.id} className="break-inside-avoid mb-3">
              <NoteCard note={note} onDelete={handleDelete} />
            </div>
          ))}
          {notes.length === 0 && !adding && (
            <div className="col-span-2 text-center py-10 text-muted-foreground text-sm">
              <div className="text-4xl mb-2">📝</div>
              אין פתקיות עדיין. לחץ "פתק חדש" כדי להתחיל.
            </div>
          )}
        </div>
      )}
    </div>
  );
}