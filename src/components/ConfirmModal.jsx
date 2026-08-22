import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-destructive">{title}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>ביטול</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}