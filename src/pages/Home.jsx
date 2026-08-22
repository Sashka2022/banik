import { useState, useEffect } from "react";
import { Plus, Loader2, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AddAreaModal from "../components/AddAreaModal";
import ConfirmModal from "../components/ConfirmModal";
import AreaSection from "../components/AreaSection";
import TopTasksSection from "../components/TopTasksSection";
import NotesSection from "../components/NotesSection";

export default function Home() {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "notes" | area_id
  const [areas, setAreas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      const [fetchedAreas, fetchedTasks] = await Promise.all([
        base44.entities.Area.list("created_date"),
        base44.entities.Task.list("-created_date"),
      ]);
      setAreas(fetchedAreas);
      setTasks(fetchedTasks);
      setLoading(false);
    };
    loadData();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubAreas = base44.entities.Area.subscribe((event) => {
      if (event.type === "create") setAreas((prev) => [...prev, event.data]);
      else if (event.type === "update") setAreas((prev) => prev.map((a) => (a.id === event.id ? event.data : a)));
      else if (event.type === "delete") setAreas((prev) => prev.filter((a) => a.id !== event.id));
    });

    const unsubTasks = base44.entities.Task.subscribe((event) => {
      if (event.type === "create") setTasks((prev) => [event.data, ...prev]);
      else if (event.type === "update") setTasks((prev) => prev.map((t) => (t.id === event.id ? event.data : t)));
      else if (event.type === "delete") setTasks((prev) => prev.filter((t) => t.id !== event.id));
    });

    return () => { unsubAreas(); unsubTasks(); };
  }, []);

  // Actions
  const handleAddArea = async (data) => {
    await base44.entities.Area.create({ ...data, sort_order: areas.length });
    setShowAddArea(false);
  };

  const handleDeleteArea = async (areaId) => {
    const tasksInArea = tasks.filter((t) => t.area_id === areaId);
    for (const t of tasksInArea) {
      await base44.entities.Task.delete(t.id);
    }
    await base44.entities.Area.delete(areaId);
    if (activeTab === areaId) setActiveTab("all");
    setAreaToDelete(null);
  };

  const handleAddTask = async (data) => {
    const task = await base44.entities.Task.create({
      ...data,
      progress: 0,
      is_completed: false,
      subtasks: [],
    });
    return task;
  };

  const handleDeleteTask = (taskId) => {
    setTaskToDelete(taskId);
  };

  const confirmDeleteTask = async () => {
    await base44.entities.Task.delete(taskToDelete);
    setTaskToDelete(null);
  };

  const handleUpdateTask = async (taskId, updates) => {
    await base44.entities.Task.update(taskId, updates);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-rubik" dir="rtl">
      {/* Modals */}
      {showAddArea && <AddAreaModal onSave={handleAddArea} onClose={() => setShowAddArea(false)} />}

      {areaToDelete && (
        <ConfirmModal
          title="מחיקת תחום עשייה"
          message={`האם אתה בטוח שברצונך למחוק את התחום "${areaToDelete.name}"? פעולה זו תמחק גם את כל המשימות שמשויכות אליו.`}
          confirmLabel="כן, מחק תחום"
          onConfirm={() => handleDeleteArea(areaToDelete.id)}
          onCancel={() => setAreaToDelete(null)}
        />
      )}

      {taskToDelete && (
        <ConfirmModal
          title="מחיקת משימה"
          message="האם אתה בטוח שברצונך למחוק משימה זו?"
          confirmLabel="כן, מחק משימה"
          onConfirm={confirmDeleteTask}
          onCancel={() => setTaskToDelete(null)}
        />
      )}

      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-20 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-black text-primary">באניק 🧠</h1>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-sm bg-accent/10 text-accent px-3 py-1.5 rounded-full font-medium border border-accent/20 hover:bg-accent/20 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" /> דשבורד
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2 items-center scroll-smooth"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
          >
            <button
              onClick={() => setActiveTab("all")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all ${
                activeTab === "all"
                  ? "bg-foreground text-background shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              כל התחומים
            </button>
            {areas.map((area) => {
              const hasPending = tasks.some((t) => t.area_id === area.id && !t.is_completed);
              return (
                <button
                  key={area.id}
                  onClick={() => setActiveTab(area.id)}
                  className={`relative whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all ${
                    activeTab === area.id
                      ? "bg-foreground text-background shadow-md"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {area.name}
                  {hasPending && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setActiveTab("notes")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-all ${
                activeTab === "notes"
                  ? "bg-foreground text-background shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              📝 פתקיות
            </button>
            <button
              onClick={() => setShowAddArea(true)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium text-primary border border-dashed border-primary/40 hover:bg-primary/5 flex-shrink-0 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-4 h-4" /> הוסף תחום
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        <div className="pb-20">
          {activeTab === "notes" ? (
            <NotesSection />
          ) : activeTab === "all" ? (
            <div>
              <TopTasksSection
                tasks={tasks}
                areas={areas}
                onDeleteTask={handleDeleteTask}
                onUpdateTask={handleUpdateTask}
              />

              <div className="border-t-2 border-border pt-6 mt-2">
                <h3 className="text-base font-bold text-muted-foreground mb-6">תמונת מצב לפי תחומים</h3>
                {areas.length > 0 ? (
                  areas.map((area) => (
                    <AreaSection
                      key={area.id}
                      area={area}
                      tasks={tasks}
                      allAreas={areas}
                      limit={3}
                      onDeleteArea={setAreaToDelete}
                      onAddTask={handleAddTask}
                      onDeleteTask={handleDeleteTask}
                      onUpdateTask={handleUpdateTask}
                      onSwitchTab={setActiveTab}
                    />
                  ))
                ) : (
                  <div className="text-center py-16 bg-card rounded-xl border-2 border-dashed border-border">
                    <div className="text-5xl mb-4">📋</div>
                    <p className="text-muted-foreground mb-4 text-sm">אין תחומי עשייה מוגדרים.</p>
                    <button
                      onClick={() => setShowAddArea(true)}
                      className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
                    >
                      + הוסף תחום ראשון
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            areas
              .filter((a) => a.id === activeTab)
              .map((area) => (
                <AreaSection
                  key={area.id}
                  area={area}
                  tasks={tasks}
                  allAreas={areas}
                  onDeleteArea={setAreaToDelete}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onSwitchTab={setActiveTab}
                />
              ))
          )}
        </div>
      </main>
    </div>
  );
}