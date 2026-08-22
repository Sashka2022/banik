import { useState } from "react";
import { Pencil, Trash2, ChevronDown, Sparkles, Zap, Calendar, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import SubtaskNode from "./SubtaskNode";
import ProgressCircle from "./ProgressCircle";
import TaskScheduler from "./TaskScheduler";

const PRIORITY_CONFIG = {
  high: { border: "border-r-red-500", badge: "bg-red-100 text-red-800", label: "דחוף 🔴", value: 3, cardBg: "bg-red-50/40" },
  medium: { border: "border-r-yellow-500", badge: "bg-yellow-100 text-yellow-800", label: "רגיל 🟡", value: 2, cardBg: "bg-yellow-50/30" },
  low: { border: "border-r-green-500", badge: "bg-green-100 text-green-800", label: "יכול להמתין 🟢", value: 1, cardBg: "bg-green-50/30" },
};

function calculateDeepProgress(subtasks) {
  if (!subtasks || subtasks.length === 0) return 0;
  let total = 0;
  let completed = 0;
  const traverse = (nodes) => {
    nodes.forEach((n) => {
      total++;
      if (n.completed) completed++;
      if (n.subtasks && n.subtasks.length > 0) traverse(n.subtasks);
    });
  };
  traverse(subtasks);
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function createGoogleCalendarLink(task) {
  if (!task.due_date) return null;
  const dateStr = task.due_date.replace(/-/g, "");
  const text = encodeURIComponent(`משימה: ${task.title}`);
  const details = encodeURIComponent("נוצר מבאניק.");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dateStr}/${dateStr}&details=${details}`;
}

export default function TaskCard({ task, area, showArea, onDelete, onUpdate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: task.title, dueDate: task.due_date || "" });
  const [newSubtask, setNewSubtask] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  const [editEstimatedHours, setEditEstimatedHours] = useState(task.estimated_hours || "");
  const [docUrl, setDocUrl] = useState(task.doc_url || null);
  const [creatingDoc, setCreatingDoc] = useState(false);

  const priority = PRIORITY_CONFIG[task.priority || "medium"];
  const isCompleted = task.is_completed || task.progress === 100;

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    await onUpdate(task.id, { is_completed: !task.is_completed });
  };

  const handleSaveEdit = async () => {
    if (editData.title.trim()) {
      await onUpdate(task.id, {
        title: editData.title,
        due_date: editData.dueDate,
        estimated_hours: editEstimatedHours ? parseFloat(editEstimatedHours) : null,
      });
    }
    setIsEditing(false);
  };

  const handleDeepAction = async (action, payload) => {
    let newSubtasks = [...(task.subtasks || [])];

    const mapNodes = (nodes, id, fn) =>
      nodes.map((n) => {
        if (n.id === id) return fn(n);
        if (n.subtasks) return { ...n, subtasks: mapNodes(n.subtasks, id, fn) };
        return n;
      });

    const filterNodes = (nodes, id) =>
      nodes.filter((n) => n.id !== id).map((n) => {
        if (n.subtasks) return { ...n, subtasks: filterNodes(n.subtasks, id) };
        return n;
      });

    const addNode = (nodes, parentId, newNode) =>
      nodes.map((n) => {
        if (n.id === parentId) return { ...n, subtasks: [...(n.subtasks || []), newNode] };
        if (n.subtasks) return { ...n, subtasks: addNode(n.subtasks, parentId, newNode) };
        return n;
      });

    switch (action) {
      case "TOGGLE":
        newSubtasks = mapNodes(newSubtasks, payload.id, (n) => ({ ...n, completed: !n.completed }));
        break;
      case "EDIT":
        newSubtasks = mapNodes(newSubtasks, payload.id, (n) => ({ ...n, ...payload, id: n.id }));
        break;
      case "DELETE":
        newSubtasks = filterNodes(newSubtasks, payload.id);
        break;
      case "ADD_CHILD":
        newSubtasks = addNode(newSubtasks, payload.parentId, {
          id: crypto.randomUUID(),
          title: payload.title,
          completed: false,
          subtasks: [],
        });
        break;
      case "ADD_TOP":
        newSubtasks.push({ id: crypto.randomUUID(), title: payload.title, completed: false, subtasks: [] });
        break;
    }
    await onUpdate(task.id, { subtasks: newSubtasks, progress: calculateDeepProgress(newSubtasks) });
  };

  const handleAITimeEstimate = async () => {
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `הערך את הזמן הנדרש לביצוע המשימה: "${task.title}". התחשב בכל תתי המשימות אם יש.${task.subtasks?.length ? ` תתי משימות: ${task.subtasks.map((s) => s.title).join(", ")}` : ""} החזר רק מספר בשעות (לדוגמה: 1.5 או 3).`,
      response_json_schema: {
        type: "object",
        properties: {
          hours: { type: "number" },
          explanation: { type: "string" },
        },
      },
    });
    if (result?.hours) {
      await onUpdate(task.id, { estimated_hours: result.hours });
      setAiMessage(`⏱️ באניק מעריך: ${result.hours} שעות${result.explanation ? " – " + result.explanation : ""}`);
      setTimeout(() => setAiMessage(null), 7000);
    }
    setAiLoading(false);
  };

  const handleAIBreakdown = async () => {
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `פרק את המשימה: "${task.title}" לעד 5 תתי-משימות קטנות ופרקטיות. כל אובייקט חייב להכיל "title" ו-"estimatedHours" (מספר בשעות).`,
      response_json_schema: {
        type: "object",
        properties: {
          subtasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                estimatedHours: { type: "number" },
              },
            },
          },
        },
      },
    });
    if (result?.subtasks && Array.isArray(result.subtasks)) {
      const existing = task.subtasks || [];
      const newItems = result.subtasks.map((item) => ({
        id: crypto.randomUUID(),
        title: item.title,
        estimatedHours: item.estimatedHours || null,
        completed: false,
        subtasks: [],
      }));
      const combined = [...existing, ...newItems];
      await onUpdate(task.id, { subtasks: combined, progress: calculateDeepProgress(combined) });
    }
    setAiLoading(false);
  };

  const handleAIMotivation = async () => {
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `כתוב משפט אחד קצר (עד 15 מילים) של מוטיבציה למשימה: "${task.title}". תהיה קליל וחיובי. חתום בתור "באניק"`,
    });
    if (result) {
      setAiMessage(result);
      setTimeout(() => setAiMessage(null), 5000);
    }
    setAiLoading(false);
  };

  const calendarLink = createGoogleCalendarLink(task);

  const handleCreateDoc = async () => {
    setCreatingDoc(true);
    // Create a new Google Doc via URL (opens a blank doc)
    const title = encodeURIComponent(task.title);
    const url = `https://docs.google.com/document/create?title=${title}`;
    const newDoc = window.open(url, "_blank");
    // We can't get the doc ID from the new tab, so we store a flag
    // and save the search-by-title URL instead
    const searchUrl = `https://drive.google.com/drive/search?q=${title}`;
    const saved = task.doc_url || searchUrl;
    if (!task.doc_url) {
      await onUpdate(task.id, { doc_url: saved });
      setDocUrl(saved);
    }
    setCreatingDoc(false);
  };

  return (
    <div
      className={`rounded-lg shadow-sm border border-border mb-3 overflow-hidden transition-all duration-200 border-r-4 ${priority.border} ${priority.cardBg} relative ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      {aiLoading && (
        <div className="absolute inset-0 bg-card/70 flex items-center justify-center z-10 backdrop-blur-[1px]">
          <Loader2 className="w-7 h-7 text-accent animate-spin" />
        </div>
      )}

      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-secondary/50 flex justify-between items-start transition-colors"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 flex items-start gap-3">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={handleToggleComplete}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 mt-1 cursor-pointer rounded border-input accent-green-600 flex-shrink-0"
            title="סמן כהושלם"
          />

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  autoFocus
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="text-right"
                />
                <div className="flex gap-2 items-center flex-wrap">
                  <Input
                    type="date"
                    value={editData.dueDate}
                    onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                    className="w-auto text-sm"
                  />
                  <Input
                    type="number"
                    min="0.25"
                    step="0.25"
                    placeholder="שעות משוערות"
                    value={editEstimatedHours}
                    onChange={(e) => setEditEstimatedHours(e.target.value)}
                    className="w-28 text-sm text-right"
                  />
                  <Button size="sm" onClick={handleSaveEdit}>שמור</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>ביטול</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="group flex items-center gap-2">
                  <h4 className={`text-base font-semibold leading-tight ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.title}
                  </h4>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                      className="text-muted-foreground hover:text-primary p-0.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center mt-1.5 gap-2 text-xs text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded-md font-medium ${priority.badge}`}>{priority.label}</span>
                  {area && showArea && (
                    <span className={`px-2 py-0.5 rounded-md font-medium text-foreground/70 ${area.color}`}>{area.name}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {task.due_date || "ללא יעד"}
                  </span>
                  {task.estimated_hours && (
                    <span className="flex items-center gap-1 bg-accent/10 text-accent px-1.5 py-0.5 rounded-full text-[11px] font-medium border border-accent/20">
                      ⏱️ {task.estimated_hours}ש׳
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center mr-2 gap-1">
          <ProgressCircle progress={task.progress} isCompleted={isCompleted} />
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* AI Message */}
      {aiMessage && (
        <div className="mx-4 mb-2 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800 font-medium animate-fade-in-up" dir="rtl">
          💡 {aiMessage}
        </div>
      )}

      {/* Expanded Section */}
      {isExpanded && !isEditing && (
        <div className="px-4 pb-4 bg-secondary/30 border-t border-border">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4 mb-4">
            <button
              onClick={handleAIBreakdown}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-full hover:bg-accent/20 transition-colors border border-accent/20"
            >
              <Sparkles className="w-3.5 h-3.5" /> פרק למשימות
            </button>
            <button
              onClick={handleAITimeEstimate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full hover:bg-purple-100 transition-colors border border-purple-200"
            >
              ⏱️ הערכת זמן (באניק)
            </button>
            <button
              onClick={handleAIMotivation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-full hover:bg-yellow-100 transition-colors border border-yellow-200"
            >
              <Zap className="w-3.5 h-3.5" /> עזור לי!
            </button>
            {calendarLink && (
              <a
                href={calendarLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-card text-foreground/70 text-xs font-medium rounded-full hover:bg-secondary transition-colors border border-border"
              >
                <Calendar className="w-3.5 h-3.5" /> הוסף ליומן
              </a>
            )}
            {docUrl ? (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <FileText className="w-3.5 h-3.5" /> פתח מסמך
              </a>
            ) : (
              <button
                onClick={handleCreateDoc}
                disabled={creatingDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" /> {creatingDoc ? "יוצר..." : "צור מסמך"}
              </button>
            )}
          </div>

          {/* Subtasks */}
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm mb-3">
            <h5 className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1.5">משימות לביצוע</h5>
            {task.subtasks && task.subtasks.length > 0 ? (
              <div className="mb-3">
                {task.subtasks.map((child) => (
                  <SubtaskNode key={child.id} node={child} onDeepAction={handleDeepAction} parentTaskTitle={task.title} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic mb-3">אין תתי-משימות. נסה להשתמש ב-AI או הוסף ידנית.</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newSubtask.trim()) {
                  handleDeepAction("ADD_TOP", { title: newSubtask });
                  setNewSubtask("");
                }
              }}
              className="flex"
            >
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="הוסף משימה חדשה לרשימה..."
                className="flex-1 text-sm border border-input rounded-r-md focus:ring-1 focus:ring-ring py-1.5 px-2 bg-background outline-none"
              />
              <button
                type="submit"
                className="bg-secondary text-muted-foreground px-3 rounded-l-md hover:bg-accent/10 transition-colors text-sm border border-r-0 border-input font-bold"
              >
                +
              </button>
            </form>
          </div>

          <TaskScheduler task={task} />

          <div className="flex justify-end mt-3">
            <button
              onClick={() => onDelete(task.id)}
              className="text-xs text-destructive hover:text-destructive/80 bg-destructive/5 px-3 py-1.5 rounded-md border border-destructive/10 transition-colors"
            >
              🗑️ מחק את כל המשימה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}