import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AREA_COLORS = [
  { value: "bg-blue-100", label: "כחול" },
  { value: "bg-green-100", label: "ירוק" },
  { value: "bg-yellow-100", label: "צהוב" },
  { value: "bg-purple-100", label: "סגול" },
  { value: "bg-pink-100", label: "ורוד" },
  { value: "bg-orange-100", label: "כתום" },
  { value: "bg-teal-100", label: "טורקיז" },
];

export default function AddAreaModal({ onSave, onClose, initial, title }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "bg-purple-100");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-card rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up border border-border">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">{title || "הגדרת תחום חדש"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">שם התחום</Label>
            <Input
              autoFocus
              required
              placeholder="לדוגמה: לימודים, משפחה, עבודה"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-right"
            />
          </div>
          <div className="mb-6">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">בחר צבע ייחודי לתחום</Label>
            <div className="flex flex-wrap gap-3">
              {AREA_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-9 h-9 rounded-full ${c.value} border-2 transition-all duration-200 ${
                    color === c.value
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>ביטול</Button>
            <Button type="submit" size="sm">{title ? "שמור שינויים" : "שמור תחום"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}