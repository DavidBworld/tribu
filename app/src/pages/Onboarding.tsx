import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbCreateFamily, dbJoinFamily } from '@/lib/supabase-data/family';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const createFamilySchema = z.object({
  name: z.string().min(2, 'Le nom de la famille doit faire au moins 2 caractères'),
  displayName: z.string().min(2, 'Le prénom doit faire au moins 2 caractères'),
});

const joinFamilySchema = z.object({
  familyId: z.string().uuid('Le code de famille doit être un identifiant unique (UUID) valide'),
  displayName: z.string().min(2, 'Le prénom doit faire au moins 2 caractères'),
});

type CreateFamilyValues = z.infer<typeof createFamilySchema>;
type JoinFamilyValues = z.infer<typeof joinFamilySchema>;

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createForm = useForm<CreateFamilyValues>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: { name: '', displayName: '' },
  });

  const joinForm = useForm<JoinFamilyValues>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: { familyId: '', displayName: '' },
  });

  const onCreateSubmit = async (values: CreateFamilyValues) => {
    setLoading(true);
    setError(null);
    try {
      await dbCreateFamily(values.name, values.displayName);
      // Re-trigger auth state validation to update layout
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Impossible de créer la famille.');
      setLoading(false);
    }
  };

  const onJoinSubmit = async (values: JoinFamilyValues) => {
    setLoading(true);
    setError(null);
    try {
      await dbJoinFamily(values.familyId, values.displayName);
      // Re-trigger auth state validation to update layout
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre la famille.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Rejoindre Tribu</CardTitle>
          <CardDescription>
            Pour commencer à utiliser Tribu, vous devez créer une nouvelle tribu ou en rejoindre une existante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tab buttons */}
          <div className="flex rounded-md bg-muted p-1">
            <button
              onClick={() => {
                setActiveTab('create');
                setError(null);
              }}
              className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Créer une tribu
            </button>
            <button
              onClick={() => {
                setActiveTab('join');
                setError(null);
              }}
              className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'join'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rejoindre une tribu
            </button>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName-create">Comment veux-tu être appelé ? (Prénom)</Label>
                <Input
                  id="displayName-create"
                  placeholder="Ex: David"
                  {...createForm.register('displayName')}
                  disabled={loading}
                />
                {createForm.formState.errors.displayName && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.displayName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom de votre tribu</Label>
                <Input
                  id="name"
                  placeholder="Ex: Famille Martin"
                  {...createForm.register('name')}
                  disabled={loading}
                />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création...' : 'Créer la tribu'}
              </Button>
            </form>
          ) : (
            <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName-join">Comment veux-tu être appelé ? (Prénom)</Label>
                <Input
                  id="displayName-join"
                  placeholder="Ex: David"
                  {...joinForm.register('displayName')}
                  disabled={loading}
                />
                {joinForm.formState.errors.displayName && (
                  <p className="text-xs text-destructive">
                    {joinForm.formState.errors.displayName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="familyId">Identifiant (ID) de la tribu</Label>
                <Input
                  id="familyId"
                  placeholder="Collez l'identifiant unique UUID..."
                  {...joinForm.register('familyId')}
                  disabled={loading}
                />
                {joinForm.formState.errors.familyId && (
                  <p className="text-xs text-destructive">
                    {joinForm.formState.errors.familyId.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Connexion...' : 'Rejoindre la tribu'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
