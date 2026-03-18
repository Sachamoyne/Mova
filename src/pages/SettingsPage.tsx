import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Copy, Key, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "ahk_";
  for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [mockLoading, setMockLoading] = useState(false);
  const queryClient = useQueryClient();
  const isDev = import.meta.env.DEV;

  const fetchApiKey = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("api_key")
      .eq("user_id", user.id)
      .single();
    setApiKey((data as { api_key: string | null } | null)?.api_key ?? null);
  }, [user]);

  useEffect(() => { fetchApiKey(); }, [fetchApiKey]);

  const handleGenerateKey = async () => {
    if (!user) return;
    setApiKeyLoading(true);
    const newKey = generateApiKey();
    const { error } = await supabase
      .from("profiles")
      .update({ api_key: newKey } as Record<string, unknown>)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { setApiKey(newKey); toast.success("Clé API générée !"); }
    setApiKeyLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copié !`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
  };

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-2xl font-display font-bold text-foreground">Paramètres</h1>

      <div className="glass-card p-6 space-y-4">
        <p className="text-sm text-muted-foreground">Connecté en tant que</p>
        <p className="text-foreground font-medium">{user?.email}</p>
        <Button variant="outline" onClick={handleSignOut}>Se déconnecter</Button>
      </div>
      {/* (Section Sync iPhone & import manuel supprimées) */}

      {/* Reset all data */}
      <div className="glass-card p-6 space-y-4 border border-destructive/30">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Réinitialiser mes données</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Supprime toutes tes activités, métriques, pesées et exercices. Ton compte et ton profil sont conservés.
        </p>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!user) return;
            const confirmed = window.confirm("Supprimer définitivement toutes tes données ? Cette action est irréversible.");
            if (!confirmed) return;
            setMockLoading(true);
            try {
              const { error } = await supabase.rpc("clear_user_data", { _user_id: user.id });
              if (error) throw error;
              queryClient.invalidateQueries();
              toast.success("Toutes les données ont été supprimées");
            } catch (e: any) {
              toast.error(e.message || "Erreur lors de la suppression");
            }
            setMockLoading(false);
          }}
          disabled={mockLoading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {mockLoading ? "Suppression..." : "Supprimer toutes mes données"}
        </Button>
      </div>

      {/* Delete account */}
      <div className="glass-card p-6 space-y-4 border border-destructive/50 bg-destructive/5">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Supprimer mon compte</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Supprime ton profil et toutes tes données de PERF-TRACK. Cette action est définitive et te déconnectera de l'application.
        </p>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!user) return;
            const confirmed = window.confirm(
              "Supprimer définitivement ton compte PERF-TRACK et toutes tes données associées ? Cette action est irréversible."
            );
            if (!confirmed) return;
            setLoading(true);
            try {
              // Supprime toutes les données liées
              const { error: clearError } = await supabase.rpc("clear_user_data", { _user_id: user.id });
              if (clearError) throw clearError;

              // Supprime le profil applicatif
              const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", user.id);
              if (profileError) throw profileError;

              // Déconnecte l'utilisateur (l'entrée auth restera côté Supabase, mais n'aura plus de données app)
              await supabase.auth.signOut();

              queryClient.clear();
              toast.success("Ton compte PERF-TRACK et tes données ont été supprimés.");
            } catch (e: any) {
              toast.error(e.message || "Erreur lors de la suppression du compte");
            }
            setLoading(false);
          }}
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {loading ? "Suppression du compte..." : "Supprimer mon compte"}
        </Button>
      </div>

      {/* Section données de test supprimée (plus de mock data) */}
    </div>
  );
}
