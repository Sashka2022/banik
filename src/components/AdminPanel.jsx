import { useState } from "react";
import { X, Trash2, Plus, AlertTriangle, RotateCcw, Loader2, Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AddAreaModal from "./AddAreaModal";
import ConfirmModal from "./ConfirmModal";

const AREA_COLORS = [
  { value: "bg-blue-100", label: "כחול" },
  { value: "bg-green-100", label: "ירוק" },
  { value: "bg-yellow-100", label: "צהוב" },
  { value: "bg-purple-100", label: "סגול" },
  { value: "bg-pink-100", label: "ורוד" },
  { value: "bg-orange-100", label: "כתום" },
  { value: "bg-teal-100", label: "טורקיז" },
];

export default function AdminPanel({ areas, tasks, onClose, onChanged }) {
  const [showAddArea, setShowAddArea] = useState(false);
  const [confirmResetAreas, setConfirmResetAreas] = useState(false);
  const [confirmResetTasks, setConfirmResetTasks] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState(null);
  const [areaToEdit, setAreaToEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleAddArea = async (data) => {
    await base44.entities.Area.create({ ...data, sort_order: areas.length });
    setShowAddArea(false);
    onChanged?.();
  };

  const handleDeleteArea = async (areaId) => {
    setBusy(true);
    const tasksInArea = tasks.filter((t) => t.area_id === areaId);
    for (const t of tasksInArea) {
      await base44.entities.Task.delete(t.id);
    }
    await base44.entities.Area.delete(areaId);
    setAreaToDelete(null);
    setBusy(false);
    onChanged?.();
  };

  const handleEditArea = async (data) => {
    await base44.entities.Area.update(areaToEdit.id, { name: data.name, color: data.color });
    setAreaToEdit(null);
    onChanged?.();
  };

  const handleResetAreas = async () => {
    setBusy(true);
    // Delete all tasks first (tasks belong to areas)
    await base44.entities.Task.deleteMany({});
    await base44.entities.Area.deleteMany({});
    setConfirmResetAreas(false);
    setBusy(false);
    onChanged?.();
  };

  const handleResetTasks = async () => {
    setBusy(true);
    await base44.entities.Task.deleteMany({});
    setConfirmResetTasks(false);
    setBusy(false);
    onChanged?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-fade-in-up border border-border">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            🛠️ פאנל אדמין
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-lg p-3 text-center border border-border">
              <div className="text-2xl font-black text-primary">{areas.length}</div>
              <div className="text-xs text-muted-foreground">תחומים</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center border border-border">
              <div className="text-2xl font-black text-primary">{tasks.length}</div>
              <div className="text-xs text-muted-foreground">משימות</div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border-2 border-destructive/20 rounded-xl p-4 bg-destructive/5">
            <h4 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> איפוס מערכת
            </h4>
            <div className="space-y-2">
              <button
                onClick={() => setConfirmResetTasks(true)}
                disabled={busy || tasks.length === 0}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-card border border-destructive/30 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> איפוס כל המשימות</span>
                <span className="text-xs opacity-70">{tasks.length} פריטים</span>
              </button>
              <button
                onClick={() => setConfirmResetAreas(true)}
                disabled={busy || areas.length === 0}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-card border border-destructive/30 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> איפוס כל התחומים</span>
                <span className="text-xs opacity-70">{areas.length} פריטים</span>
              </button>
            </div>
          </div>

          {/* Areas management */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-foreground">ניהול תחומים</h4>
              <button
                onClick={() => setShowAddArea(true)}
                className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> הוסף תחום
              </button>
            </div>
            <div className="space-y-2">
              {areas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">אין תחומים מוגדרים</p>
              ) : (
                areas.map((area) => {
                  const count = tasks.filter((t) => t.area_id === area.id).length;
                  return (
                    <div key={area.id} className="flex items-center justify-between bg-secondary/40 border border-border rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${area.color}`} />
                        <span className="text-sm font-medium text-foreground truncate">{area.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">({count} משימות)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAreaToEdit(area)}
                          disabled={busy}
                          className="text-muted-foreground hover:text-primary transition-colors p-1 disabled:opacity-50"
                          title="ערוך תחום"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setAreaToDelete(area)}
                          disabled={busy}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-50"
                          title="מחק תחום"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddArea && <AddAreaModal onSave={handleAddArea} onClose={() => setShowAddArea(false)} />}

      {areaToEdit && (
        <AddAreaModal
          initial={areaToEdit}
          title="עריכת תחום"
          onSave={handleEditArea}
          onClose={() => setAreaToEdit(null)}
        />
      )}

      {confirmResetAreas && (
        <ConfirmModal
          title="איפוס כל התחומים"
          message="פעולה זו תמחק את כל התחומים וכל המשימות ששייכות להם. האם אתה בטוח?"
          confirmLabel="כן, אפס הכל"
          onConfirm={handleResetAreas}
          onCancel={() => setConfirmResetAreas(false)}
        />
      )}

      {confirmResetTasks && (
        <ConfirmModal
          title="איפוס כל המשימות"
          message="פעולה זו תמחק את כל המשימות. התחומים יישארו. האם אתה בטוח?"
          confirmLabel="כן, מחק משימות"
          onConfirm={handleResetTasks}
          onCancel={() => setConfirmResetTasks(false)}
        />
      )}

      {areaToDelete && (
        <ConfirmModal
          title="מחיקת תחום"
          message={`האם למחוק את "${areaToDelete.name}"? כל המשימות בתחום זה ימחקו.`}
          confirmLabel="כן, מחק תחום"
          onConfirm={() => handleDeleteArea(areaToDelete.id)}
          onCancel={() => setAreaToDelete(null)}
        />
      )}

      {busy && (
        <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
    </div>
  );
}