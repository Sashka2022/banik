import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Builds a Google Calendar "quick add" link that opens a pre-filled event for
// the user to save themselves — no login/OAuth/backend needed. Pass a plain
// due_date ("YYYY-MM-DD") for an all-day event, or start/end Date objects for
// a timed event.
export function createGoogleCalendarLink({ title, details, dueDate, start, end }) {
  const text = encodeURIComponent(title);
  const desc = encodeURIComponent(details || "נוצר מבאניק.");

  let dates;
  if (start && end) {
    const toUtcBasic = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    dates = `${toUtcBasic(start)}/${toUtcBasic(end)}`;
  } else if (dueDate) {
    const dateStr = dueDate.replace(/-/g, "");
    dates = `${dateStr}/${dateStr}`;
  } else {
    return null;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${desc}`;
}
