import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tasks = await base44.entities.Task.list();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const urgent = tasks
      .filter((t) => !t.is_completed && t.due_date)
      .map((t) => {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        const daysLeft = Math.floor((due - today) / (1000 * 60 * 60 * 24));
        return { ...t, daysLeft };
      })
      .filter((t) => t.daysLeft <= 2)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (urgent.length === 0) {
      return Response.json({ sent: false, reason: 'No urgent tasks' });
    }

    const lines = urgent.map((t) => {
      const label = t.daysLeft < 0
        ? `⛔ פגר ב-${Math.abs(t.daysLeft)} ימים`
        : t.daysLeft === 0
        ? '⚡ היום!'
        : `⏰ עוד ${t.daysLeft} ימים`;
      const priority = t.priority === 'high' ? '🔴 דחוף' : t.priority === 'medium' ? '🟡 רגיל' : '🟢 יכול להמתין';
      return `• ${t.title} — ${label} (${priority})`;
    }).join('\n');

    const body = `שלום ${user.full_name || ''},\n\nיש לך ${urgent.length} משימות שדורשות תשומת לב בקרוב:\n\n${lines}\n\nכנס לאפליקציה כדי לנהל את המשימות שלך.\n\n— באניק 🧠`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `⚠️ באניק: ${urgent.length} משימות דחופות ממתינות לך`,
      body,
    });

    return Response.json({ sent: true, count: urgent.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});