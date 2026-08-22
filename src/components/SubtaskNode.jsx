import { useState } from "react";
import { Pencil, Plus, Trash2, Clock, CalendarDays } from "lucide-react";

export default function SubtaskNode({ node, level = 0, onDeepAction, parentTaskTitle = "" }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [showHoursInput, setShowHoursInput] = useState(false);
  const [hoursValue, setHoursValue] = useState(node.estimatedHours || "");

  const handleSaveEdit = () => {
    if (editTitle.trim()) onDeepAction("EDIT", { id: node.id, title: editTitle });
    setIsEditing(false);
  };

  const handleSaveHours = () => {
    const h = parseFloat(hoursValue);
    onDeepAction("EDIT", { id: node.id, estimatedHours: isNaN(h) ? null : h });
    setShowHoursInput(false);
  };

  const handleOpenCalendar = () => {
    const text = encodeURIComponent(`📌 ${node.title}${parentTaskTitle ? ` (${parentTaskTitle})` : ""}`);
    const details = encodeURIComponent("נוצר מבאניק 🧠");
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`, "_blank");
  };

  const handleAddChild = (e) => {
    e.preventDefault();
    if (childTitle.trim()) {
      onDeepAction("ADD_CHILD", { parentId: node.id, title: childTitle });
      setChildTitle("");
      setShowAddChild(false);
    }
  };

  return (
    <div className="mt-1" style={{ marginRight: `${level * 1.5}rem` }}>
      <div className="flex items-center group hover:bg-primary/5 p-1.5 rounded-md transition-colors border border-transparent hover:border-border">
        <input
          type="checkbox"
          checked={node.completed}
          onChange={() => onDeepAction("TOGGLE", { id: node.id })}
          className="w-4 h-4 text-primary rounded border-input focus:ring-ring cursor-pointer ml-3 flex-shrink-0 accent-primary"
        />

        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
            className="flex-1 text-sm border-b-2 border-primary bg-card px-1 outline-none"
          />
        ) : (
          <div className={`flex-1 text-sm flex items-center flex-wrap gap-2 ${node.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            <span>{node.title}</span>
            {node.estimatedHours && (
              <span className="text-[10px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded-full border border-accent/20">
                ⏱️ {node.estimatedHours}h
              </span>
            )}
          </div>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 mr-2 text-muted-foreground transition-opacity">
          <button onClick={() => setIsEditing(true)} className="hover:text-primary p-0.5" title="ערוך">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setShowHoursInput(!showHoursInput); setHoursValue(node.estimatedHours || ""); }} className="hover:text-accent p-0.5" title="הערכת זמן">
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleOpenCalendar} className="hover:text-blue-600 p-0.5" title="שבץ ביומן">
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowAddChild(!showAddChild)} className="hover:text-green-600 p-0.5" title="הוסף תת-משימה">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDeepAction("DELETE", { id: node.id })} className="hover:text-destructive p-0.5" title="מחק">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showHoursInput && (
        <div className="flex items-center gap-2 mt-1 px-1" style={{ marginRight: `${(level + 1) * 1.5}rem` }}>
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={hoursValue}
            onChange={(e) => setHoursValue(e.target.value)}
            placeholder="שעות משוערות..."
            className="text-xs border border-input rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-ring bg-background w-32 text-right"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveHours()}
          />
          <button onClick={handleSaveHours} className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-md border border-accent/20 hover:bg-accent/20 font-medium">שמור</button>
          <button onClick={() => setShowHoursInput(false)} className="text-xs text-muted-foreground hover:text-foreground">ביטול</button>
        </div>
      )}

      {showAddChild && (
        <form onSubmit={handleAddChild} className="flex mt-1" style={{ marginRight: "1.5rem" }}>
          <input
            type="text"
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            placeholder="תת-משימה חדשה..."
            className="flex-1 text-xs border border-input rounded-r-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring bg-background"
            autoFocus
          />
          <button type="submit" className="bg-secondary px-2.5 border border-r-0 border-input rounded-l-md text-muted-foreground hover:bg-accent/10 text-xs font-bold">
            +
          </button>
        </form>
      )}

      {node.subtasks &&
        node.subtasks.map((child) => (
          <SubtaskNode key={child.id} node={child} level={level + 1} onDeepAction={onDeepAction} parentTaskTitle={parentTaskTitle} />
        ))}
    </div>
  );
}