import { AlertTriangle, Clock, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

function getDaysUntilDue(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
}

export default function UrgentTasksAlert({ tasks }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const urgent = tasks
    .filter((t) => !t.is_completed && t.due_date)
    .map((t) => ({ ...t, daysLeft: getDaysUntilDue(t.due_date) }))
    .filter((t) => t.daysLeft !== null && t.daysLeft <= 2)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (urgent.length === 0) return null;

  const overdue = urgent.filter((t) => t.daysLeft < 0);
  const dueToday = urgent.filter((t) => t.daysLeft === 0);
  const dueSoon = urgent.filter((t) => t.daysLeft === 1 || t.daysLeft === 2);

  return (
    <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-xl p-4 relative animate-fade-in-up shadow-md">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 left-3 text-red-400 hover:text-red-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
          <AlertTriangle className="w-3.5 h-3.5" />
          {urgent.length} משימות דורשות תשומת לב!
        </div>
      </div>

      <div className="space-y-2">
        {overdue.length > 0 && (
          <div>
            <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
              🚨 פג תוקף ({overdue.length})
            </p>
            {overdue.map((t) => (
              <AlertRow key={t.id} task={t} variant="overdue" />
            ))}
          </div>
        )}
        {dueToday.length > 0 && (
          <div>
            <p className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1">
              ⚡ היום ({dueToday.length})
            </p>
            {dueToday.map((t) => (
              <AlertRow key={t.id} task={t} variant="today" />
            ))}
          </div>
        )}
        {dueSoon.length > 0 && (
          <div>
            <p className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> בקרוב ({dueSoon.length})
            </p>
            {dueSoon.map((t) => (
              <AlertRow key={t.id} task={t} variant="soon" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow({ task, variant }) {
  const styles = {
    overdue: "bg-red-100 border-red-300 text-red-800",
    today: "bg-orange-100 border-orange-300 text-orange-800",
    soon: "bg-yellow-100 border-yellow-300 text-yellow-800",
  };
  const label = {
    overdue: `פגר ב-${Math.abs(task.daysLeft)} יום`,
    today: "היום!",
    soon: `עוד ${task.daysLeft} ימים`,
  };
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-medium mb-1 ${styles[variant]}`}>
      <span className="truncate flex-1">{task.title}</span>
      <span className="flex-shrink-0 mr-2 font-bold">{label[variant]}</span>
    </div>
  );
}