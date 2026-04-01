import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConsentPageProps = {
  onAccept: () => Promise<void> | void;
  onDecline: () => void;
  isLoading?: boolean;
};

export default function ConsentPage({ onAccept, onDecline, isLoading = false }: ConsentPageProps) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 border border-white/20">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <p className="text-2xl font-display font-bold">Mova</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-white/15 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Confidentialité et données</h1>
          <p className="text-sm leading-6 text-white/90 whitespace-pre-line">
            {"Mova synchronise tes données de santé (activité, nutrition, sommeil, fréquence cardiaque) sur nos serveurs sécurisés afin de conserver ton historique.\nTes données ne sont jamais partagées avec des tiers.\nEn continuant, tu acceptes que tes données soient stockées sur nos serveurs."}
          </p>

          <div className="space-y-3 rounded-xl border border-white/15 bg-black/40 p-4">
            <p className="text-base font-semibold">❤️ Cette app utilise Apple HealthKit</p>
            <p className="text-sm text-white/90">Les données suivantes seront lues depuis Apple Santé :</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-white/90">
              <li>Activité physique et entraînements</li>
              <li>Nutrition (calories, protéines, glucides, lipides)</li>
              <li>Sommeil et qualité du sommeil</li>
              <li>Fréquence cardiaque et HRV</li>
              <li>Composition corporelle (poids, masse grasse)</li>
              <li>Nombre de pas</li>
            </ul>
          </div>

          <div className="space-y-3 pt-2">
            <Button className="w-full" onClick={onAccept} disabled={isLoading}>
              {isLoading ? "Autorisation en cours..." : "J'accepte"}
            </Button>
            <Button variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10" onClick={onDecline} disabled={isLoading}>
              Refuser — données locales uniquement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
