import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";

type Sport = "tennis" | "padel";
type SessionType = "training" | "match";

export default function LogSessionDrawer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<Sport>("tennis");
  const [sessionType, setSessionType] = useState<SessionType>("training");
  const [durationMin, setDurationMin] = useState("");
  const [opponent, setOpponent] = useState("");
  const [score, setScore] = useState("");
  const [result, setResult] = useState<"win" | "loss">("win");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setSport("tennis");
    setSessionType("training");
    setDurationMin("");
    setOpponent("");
    setScore("");
    setResult("win");
  };

  const handleSubmit = async () => {
    if (!user) return;
    const dur = parseInt(durationMin);
    if (!dur || dur <= 0) {
      toast.error("Durée invalide");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      sport_type: sport,
      start_time: new Date().toISOString(),
      duration_sec: dur * 60,
      session_type: sessionType,
      opponent_name: sessionType === "match" ? opponent || null : null,
      match_score: sessionType === "match" ? score || null : null,
      match_result: sessionType === "match" ? result : null,
    });

    if (error) {
      toast.error("Erreur lors de l'enregistrement");
    } else {
      toast.success("Session enregistrée !");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      reset();
      setOpen(false);
    }
    setLoading(false);
  };

  const sportColor = sport === "tennis" ? "tennis" : "padel";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Log Session
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="font-display">Nouvelle session</DrawerTitle>
          <DrawerDescription>Enregistrez votre entraînement ou match</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-5">
          {/* Sport selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sport</Label>
            <div className="flex gap-2">
              {(["tennis", "padel"] as Sport[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    sport === s
                      ? s === "tennis"
                        ? "bg-tennis/15 border-tennis/40 text-tennis"
                        : "bg-padel/15 border-padel/40 text-padel"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "tennis" ? "🎾 Tennis" : "🏸 Padel"}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-xs text-muted-foreground">Durée (minutes)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="60"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              min={1}
            />
          </div>

          {/* Session type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Type de session</Label>
            <div className="flex gap-2">
              {(["training", "match"] as SessionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSessionType(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    sessionType === t
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "training" ? "Entraînement" : "Match"}
                </button>
              ))}
            </div>
          </div>

          {/* Match fields */}
          {sessionType === "match" && (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-200">
              <div className="space-y-2">
                <Label htmlFor="opponent" className="text-xs text-muted-foreground">Adversaire</Label>
                <Input
                  id="opponent"
                  placeholder="Jean-Marc"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score" className="text-xs text-muted-foreground">Score (ex: 6-4, 4-6, 10-8)</Label>
                <Input
                  id="score"
                  placeholder="6-4, 4-6, 10-8"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Résultat</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResult("win")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      result === "win"
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ✅ Victoire
                  </button>
                  <button
                    onClick={() => setResult("loss")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      result === "loss"
                        ? "bg-destructive/15 border-destructive/40 text-destructive"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ❌ Défaite
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Enregistrement..." : "Enregistrer la session"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Annuler</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
