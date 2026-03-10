import { useState, useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Dumbbell } from "lucide-react";
import { useInsertExerciseStat, useUniqueExerciseNames } from "@/hooks/useExerciseStats";
import { toast } from "sonner";

interface ExerciseEntry {
  name: string;
  weight: string;
  sets: string;
  reps: string;
}

export default function LogSessionDrawer() {
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    { name: "", weight: "", sets: "3", reps: "10" },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const existingNames = useUniqueExerciseNames();
  const mutation = useInsertExerciseStat();

  const updateExercise = (idx: number, field: keyof ExerciseEntry, value: string) => {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
    if (field === "name") {
      setActiveSuggestionIdx(idx);
      if (value.length > 0) {
        const filtered = existingNames.filter((n) =>
          n.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered);
      } else {
        setSuggestions([]);
      }
    }
  };

  const selectSuggestion = (idx: number, name: string) => {
    updateExercise(idx, "name", name);
    setSuggestions([]);
    setActiveSuggestionIdx(null);
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: "", weight: "", sets: "3", reps: "10" }]);
  };

  const removeExercise = (idx: number) => {
    if (exercises.length <= 1) return;
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const valid = exercises.filter((e) => e.name.trim() && e.weight);
    if (valid.length === 0) {
      toast.error("Ajoute au moins un exercice avec un poids");
      return;
    }

    try {
      for (const ex of valid) {
        await mutation.mutateAsync({
          exercise_name: ex.name.trim(),
          weight_kg: parseFloat(ex.weight),
          sets: parseInt(ex.sets) || 3,
          reps: parseInt(ex.reps) || 10,
        });
      }
      toast.success(`${valid.length} exercice(s) enregistré(s)`);
      setExercises([{ name: "", weight: "", sets: "3", reps: "10" }]);
      setOpen(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2 border-strength/30 text-strength hover:bg-strength/10">
          <Dumbbell className="h-4 w-4" />
          Log Session
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-card border-border max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="font-display text-foreground">Enregistrer une séance</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-4 overflow-y-auto max-h-[55vh]">
          {exercises.map((ex, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Exercice {idx + 1}</span>
                {exercises.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeExercise(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  placeholder="Nom de l'exercice (ex: Squat)"
                  value={ex.name}
                  onChange={(e) => updateExercise(idx, "name", e.target.value)}
                  onFocus={() => {
                    setActiveSuggestionIdx(idx);
                    if (ex.name.length > 0) {
                      setSuggestions(existingNames.filter((n) => n.toLowerCase().includes(ex.name.toLowerCase())));
                    }
                  }}
                  onBlur={() => setTimeout(() => { setActiveSuggestionIdx(null); setSuggestions([]); }, 150)}
                  className="bg-secondary border-border"
                />
                {activeSuggestionIdx === idx && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-32 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                        onMouseDown={() => selectSuggestion(idx, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Poids (kg)</Label>
                  <Input type="number" step="0.5" value={ex.weight} onChange={(e) => updateExercise(idx, "weight", e.target.value)} placeholder="80" className="bg-secondary border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Séries</Label>
                  <Input type="number" value={ex.sets} onChange={(e) => updateExercise(idx, "sets", e.target.value)} className="bg-secondary border-border" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reps</Label>
                  <Input type="number" value={ex.reps} onChange={(e) => updateExercise(idx, "reps", e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>
            </div>
          ))}
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-strength" onClick={addExercise}>
            <Plus className="h-4 w-4" />
            Ajouter un exercice
          </Button>
        </div>
        <DrawerFooter>
          <Button onClick={handleSubmit} disabled={mutation.isPending} className="bg-strength hover:bg-strength/80 text-primary-foreground">
            {mutation.isPending ? "Enregistrement..." : "Enregistrer la séance"}
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost">Annuler</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
