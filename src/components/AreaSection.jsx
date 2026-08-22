import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import TaskCard from "./TaskCard";
import AddTaskForm from "./AddTaskForm";

export default function AreaSection({ area, tasks, allAreas, limit, onDeleteArea, onAddTask, onDeleteTask, onUpdateTask, onSwitchTab }) {
  const [isAddingTask, setIsAddingTask] = useState(false);

  const areaTasks = tasks.filter((t) => t.area_id === area.id);
  const tasksToDisplay = limit ? areaTasks.slice(0, limit) : areaTasks;

  const areaProgress = (() => {
    if (areaTasks.length === 0) return 0;
    const total = areaTasks.reduce((sum, t) => {
      if (t.is_completed) return sum + 100;
      return sum + (t.progress || 0);
    }, 0);
    return Math.round(total / areaTasks.length);
  })();

  const handleSaveTask = async (taskData) => {
    const task = await onAddTask(taskData);
    return task; // let AddTaskForm use it for calendar scheduling
    // note: we don't close the form here — AddTaskForm handles its own post-save state
  };

  return (
    <div className="mb-10 pt-4">
      {/* Area Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-8 rounded-full ${area.color || "bg-muted"}`} />
          <h2 className="text-xl font-bold text-foreground">{area.name}</h2>
          <button
            onClick={() => onDeleteArea(area)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors"
            title="מחק תחום"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">מחק</span>
          </button>
        </div>
        <div className="w-full sm:w-36">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>התקדמות</span>
            <span className="font-medium">{areaProgress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${areaProgress === 100 ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${areaProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div>
        {tasksToDisplay.length > 0 ? (
          tasksToDisplay.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              area={area}
              showArea={false}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
            />
          ))
        ) : (
          <p className="text-muted-foreground text-sm italic mb-4">אין משימות בתחום זה עדיין.</p>
        )}
      </div>

      {/* Show More */}
      {limit && areaTasks.length > limit && (
        <button
          className="w-full text-center mb-4 text-sm font-medium text-primary bg-primary/5 py-2.5 rounded-lg border border-primary/10 hover:bg-primary/10 transition-colors"
          onClick={() => {
            onSwitchTab(area.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          ראו עוד {areaTasks.length - limit} משימות
        </button>
      )}

      {/* Add Task */}
      {isAddingTask ? (
        <AddTaskForm
          areaId={area.id}
          onSave={handleSaveTask}
          onCancel={() => setIsAddingTask(false)}

        />
      ) : (
        <button
          onClick={() => setIsAddingTask(true)}
          className="w-full py-3 border-2 border-dashed border-border text-muted-foreground rounded-lg font-medium hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> הוסף משימה לתחום {area.name}
        </button>
      )}
    </div>
  );
}