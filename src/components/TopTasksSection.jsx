import { Target } from "lucide-react";
import TaskCard from "./TaskCard";

const PRIORITY_VALUES = { high: 3, medium: 2, low: 1 };

export default function TopTasksSection({ tasks, areas, onDeleteTask, onUpdateTask }) {
  const topTasks = [...tasks]
    .sort((a, b) => {
      const aDone = a.is_completed ? 1 : 0;
      const bDone = b.is_completed ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (PRIORITY_VALUES[b.priority || "medium"] || 0) - (PRIORITY_VALUES[a.priority || "medium"] || 0);
    })
    .slice(0, 5);

  if (topTasks.length === 0) return null;

  return (
    <div className="mb-10 pt-2">
      <div className="flex items-center justify-between mb-4 bg-card p-3.5 rounded-lg border border-red-100 shadow-sm">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-red-500" />
          למיקוד עכשיו
        </h2>
        <span className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-semibold">
          Top {topTasks.length}
        </span>
      </div>
      {topTasks.map((task) => (
        <TaskCard
          key={`top-${task.id}`}
          task={task}
          area={areas.find((a) => a.id === task.area_id)}
          showArea={true}
          onDelete={onDeleteTask}
          onUpdate={onUpdateTask}
        />
      ))}
    </div>
  );
}