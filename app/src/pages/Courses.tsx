import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dbGetFamilyMembership } from '@/lib/supabase-data/family';
import {
  dbListShoppingItems,
  dbCreateShoppingItem,
  dbUpdateShoppingItem,
  dbDeleteShoppingItem,
  type ShoppingItem,
} from '@/lib/supabase-data/shopping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Store,
  Snowflake,
  Wine,
  Sparkles,
  FolderOpen,
  User
} from 'lucide-react';

const RAYONS = [
  { name: 'Épicerie', icon: Store, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' },
  { name: 'Frais', icon: Snowflake, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900' },
  { name: 'Boissons', icon: Wine, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900' },
  { name: 'Hygiène', icon: Sparkles, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900' },
  { name: 'Sans catégorie', icon: FolderOpen, color: 'text-muted-foreground bg-muted/20 border-muted' },
];

export default function Courses() {
  const queryClient = useQueryClient();
  const [newItemName, setNewItemName] = useState('');
  const [newRayon, setNewRayon] = useState('Épicerie');
  const [isAchetesOpen, setIsAchetesOpen] = useState(false);

  // 1. Charger l'appartenance à la famille
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: dbGetFamilyMembership,
  });

  const familyId = membership?.family_id;
  const currentMemberId = membership?.id;

  // 2. Charger les articles
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shoppingItems', familyId],
    queryFn: () => dbListShoppingItems(familyId!),
    enabled: !!familyId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: ({ name, rayon }: { name: string; rayon: string }) =>
      dbCreateShoppingItem(name, rayon, familyId!, currentMemberId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingItems', familyId] });
      setNewItemName('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      dbUpdateShoppingItem(id, { done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingItems', familyId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dbDeleteShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingItems', familyId] });
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || createMutation.isPending) return;
    createMutation.mutate({ name: newItemName.trim(), rayon: newRayon });
  };

  // Séparer les articles actifs et achetés
  const activeItems = items.filter((item) => !item.done);
  const boughtItems = items.filter((item) => item.done);

  // Grouper les articles actifs par rayon
  const groupedActiveItems = activeItems.reduce((groups, item) => {
    const r = item.rayon || 'Sans catégorie';
    if (!groups[r]) groups[r] = [];
    groups[r].push(item);
    return groups;
  }, {} as Record<string, ShoppingItem[]>);

  // Compter le total restant
  const totalRemaining = activeItems.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* En-tête de la page */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingCart className="h-8 w-8 text-primary" /> Liste de courses
          </h2>
          <p className="text-muted-foreground mt-1">
            Gérez la liste de courses partagée en temps réel de votre tribu.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {totalRemaining} article{totalRemaining !== 1 ? 's' : ''} restant{totalRemaining !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Formulaire d'ajout rapide */}
      <Card className="p-4 border-primary/10 bg-card shadow-sm">
        <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Ajouter un article (ex: Lait, Pâtes...)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-background"
              maxLength={100}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newRayon}
              onChange={(e) => setNewRayon(e.target.value)}
              className="flex h-8 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {RAYONS.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={!newItemName.trim() || createMutation.isPending} className="shrink-0 h-8">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
        </form>
      </Card>

      {/* Liste principale (Groupée par rayon) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-sm">Chargement des courses...</p>
        </div>
      ) : activeItems.length === 0 ? (
        <div className="text-center p-12 rounded-xl border border-dashed border-muted bg-muted/10">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Aucun article dans votre liste.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez-en un ci-dessus pour commencer !</p>
        </div>
      ) : (
        <div className="space-y-6">
          {RAYONS.map((rayonConfig) => {
            const itemsInRayon = groupedActiveItems[rayonConfig.name] || [];
            if (itemsInRayon.length === 0) return null;

            const IconComponent = rayonConfig.icon;

            return (
              <div key={rayonConfig.name} className="space-y-2.5">
                {/* En-tête Rayon */}
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-muted-foreground/80 px-1">
                  <span className={`p-1.5 rounded-md border ${rayonConfig.color}`}>
                    <IconComponent className="h-4 w-4" />
                  </span>
                  <span>{rayonConfig.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">({itemsInRayon.length})</span>
                </div>

                {/* Grille d'articles */}
                <div className="grid gap-2">
                  {itemsInRayon.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/10 transition-all shadow-xs group"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Case à cocher */}
                        <button
                          onClick={() => toggleMutation.mutate({ id: item.id, done: true })}
                          className="h-5 w-5 rounded-full border-2 border-primary/30 hover:border-primary flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-transparent hover:bg-primary/50 transition-colors" />
                        </button>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>
                              Ajouté par {item.family_members?.display_name || 'Quelqu\'un'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 pl-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section collapsible des articles achetés */}
      {boughtItems.length > 0 && (
        <div className="pt-4 border-t border-muted/80">
          <button
            onClick={() => setIsAchetesOpen(!isAchetesOpen)}
            className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span>Articles achetés ({boughtItems.length})</span>
            </div>
            {isAchetesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {isAchetesOpen && (
            <div className="mt-3 grid gap-2 pl-2">
              {boughtItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-muted bg-card/60 opacity-75 hover:opacity-100 transition-all"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: item.id, done: false })}
                      className="h-5 w-5 rounded-full border-2 border-green-600 bg-green-50 dark:bg-green-950/20 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </button>
                    <div className="truncate">
                      <p className="text-sm font-medium text-muted-foreground line-through truncate">{item.name}</p>
                      <span className="text-[10px] text-muted-foreground/60 block mt-0.5">
                        Acheté (ajouté par {item.family_members?.display_name || 'Quelqu\'un'})
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="text-destructive/50 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
