import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { dbGetFamilyMembership } from '@/lib/supabase-data/family';
import {
  dbListRecipes,
  dbCreateRecipe,
  dbUpdateRecipe,
  dbDeleteRecipe,
  dbUploadRecipeImage,
  type Recipe,
} from '@/lib/supabase-data/recipes';
import { dbAddIngredientsToShopping } from '@/lib/supabase-data/shopping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  BookOpen,
  Plus,
  Clock,
  Wine,
  Trash2,
  Edit,
  Check,
  X,
  Search,
  Utensils,
  ShoppingBag,
  Upload
} from 'lucide-react';

// Schéma Zod pour le formulaire de recette
const recipeFormSchema = z.object({
  title: z.string().min(1, 'Le titre de la recette est obligatoire'),
  description: z.string().optional(),
  prep_time: z.string().optional(),
  cook_time: z.string().optional(),
  servings: z.string().optional(),
  wine_pairing: z.string().optional(),
  difficulty: z.string().optional(),
  hero_image_url: z.string().optional(),
  tags: z.array(z.string()),
  ingredients: z.array(
    z.object({
      qty: z.string().optional(),
      unit: z.string().optional(),
      name: z.string().optional(),
    })
  ).optional(),
  steps: z.array(
    z.object({
      title: z.string().optional(),
      desc: z.string().optional(),
      photo: z.string().nullable().optional(),
    })
  ).optional(),
});

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

const DIFFICULTIES = ['Facile', 'Moyen', 'Difficile'];
const PRESET_TAGS = ['Plat', 'Dessert', 'Entrée', 'Végétarien', 'Rapide', 'Gâteau', 'Apéro'];

export default function Cuisine() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // États pour les fiches (Bottom Sheets)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  
  // États pour l'ajout aux courses depuis le détail
  const [isAddToCartOpen, setIsAddToCartOpen] = useState(false);
  const [cartIngredients, setCartIngredients] = useState<Array<{ name: string; checked: boolean }>>([]);
  const [cartRayon, setCartRayon] = useState('Épicerie');

  // État local de liste d'ingrédients cochés pour le détail de la recette
  const [checkedIngredientsLocal, setCheckedIngredientsLocal] = useState<Record<number, boolean>>({});

  // Image Upload States
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingStepIndex, setUploadingStepIndex] = useState<number | null>(null);

  // Références d'input file
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // 1. Charger l'appartenance à la famille
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: dbGetFamilyMembership,
  });

  const familyId = membership?.family_id;
  const currentMemberId = membership?.id;

  // 2. Charger les recettes
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes', familyId],
    queryFn: () => dbListRecipes(familyId!),
    enabled: !!familyId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: dbCreateRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Recipe> }) => dbUpdateRecipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dbDeleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
      setSelectedRecipe(null);
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: (items: Array<{ name: string; rayon: string }>) =>
      dbAddIngredientsToShopping(familyId!, currentMemberId || null, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingItems', familyId] });
      setIsAddToCartOpen(false);
      // Optionnel : Notification à l'utilisateur
    },
  });

  // react-hook-form
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      title: '',
      description: '',
      prep_time: '',
      cook_time: '',
      servings: '',
      wine_pairing: '',
      difficulty: 'Facile',
      hero_image_url: '',
      tags: [],
      ingredients: [{ qty: '', unit: '', name: '' }],
      steps: [{ title: '', desc: '', photo: '' }],
    },
  });

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({
    control,
    name: 'ingredients',
  });

  const {
    fields: stepFields,
    append: appendStep,
    remove: removeStep,
  } = useFieldArray({
    control,
    name: 'steps',
  });

  const watchedTags = watch('tags') || [];
  const watchedHeroUrl = watch('hero_image_url');
  const watchedSteps = watch('steps') || [];

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const url = await dbUploadRecipeImage(file);
      setValue('hero_image_url', url);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de l'image.");
    } finally {
      setUploadingHero(false);
    }
  };

  const handleStepImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStepIndex(index);
    try {
      const url = await dbUploadRecipeImage(file);
      setValue(`steps.${index}.photo`, url);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de l'image de l'étape.");
    } finally {
      setUploadingStepIndex(null);
    }
  };

  const toggleTagInForm = (tag: string) => {
    const currentTags = watchedTags;
    if (currentTags.includes(tag)) {
      setValue('tags', currentTags.filter((t) => t !== tag));
    } else {
      setValue('tags', [...currentTags, tag]);
    }
  };

  const openCreateForm = () => {
    setEditingRecipe(null);
    reset({
      title: '',
      description: '',
      prep_time: '',
      cook_time: '',
      servings: '',
      wine_pairing: '',
      difficulty: 'Facile',
      hero_image_url: '',
      tags: [],
      ingredients: [{ qty: '', unit: '', name: '' }],
      steps: [{ title: '', desc: '', photo: '' }],
    });
    setIsFormOpen(true);
  };

  const openEditForm = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    reset({
      title: recipe.title,
      description: recipe.description || '',
      prep_time: recipe.prep_time || '',
      cook_time: recipe.cook_time || '',
      servings: recipe.servings || '',
      wine_pairing: recipe.wine_pairing || '',
      difficulty: recipe.difficulty || 'Facile',
      hero_image_url: recipe.hero_image_url || '',
      tags: recipe.tags || [],
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingRecipe(null);
  };

  const onSubmit = (values: RecipeFormValues) => {
    if (!familyId) return;
    const finalData = {
      ...values,
      family_id: familyId,
    };
    if (editingRecipe) {
      updateMutation.mutate({ id: editingRecipe.id, data: finalData });
    } else {
      createMutation.mutate(finalData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer cette recette ?')) {
      deleteMutation.mutate(id);
    }
  };

  // Préparer les ingrédients pour l'ajout aux courses
  const openAddToCart = (recipe: Recipe) => {
    const formatted = recipe.ingredients
      .filter((i) => i.name)
      .map((i) => {
        let label = '';
        if (i.qty) label += i.qty + ' ';
        if (i.unit) label += i.unit + ' ';
        label += i.name;
        return { name: label.trim(), checked: true };
      });
    setCartIngredients(formatted);
    setCartRayon('Épicerie');
    setIsAddToCartOpen(true);
  };

  const handleAddSelectedToCart = () => {
    const selected = cartIngredients.filter((i) => i.checked);
    if (selected.length === 0) return;

    const itemsToAdd = selected.map((i) => ({
      name: i.name,
      rayon: cartRayon,
    }));

    addToCartMutation.mutate(itemsToAdd);
  };

  // Filtrer les recettes
  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = selectedTag ? r.tags?.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-primary" /> Cuisine & Recettes
          </h2>
          <p className="text-muted-foreground mt-1">
            Conservez, créez et partagez les recettes préférées de la famille.
          </p>
        </div>
        <Button onClick={openCreateForm} className="sm:self-center shrink-0 h-8">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle Recette
        </Button>
      </div>

      {/* Barre de recherche et de filtres */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une recette par titre ou description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        
        {/* Catégories de filtres de tags */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setSelectedTag(null)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
              selectedTag === null
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-muted/40 hover:bg-muted border-transparent text-muted-foreground'
            }`}
          >
            Tout
          </button>
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                selectedTag === tag
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/40 hover:bg-muted border-transparent text-muted-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Liste de recettes */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-sm">Chargement des recettes...</p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="text-center p-12 rounded-xl border border-dashed border-muted bg-muted/10">
          <Utensils className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Aucune recette trouvée.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Créez votre première recette en cliquant sur "Nouvelle Recette" !</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredRecipes.map((recipe) => (
            <Card
              key={recipe.id}
              onClick={() => {
                setSelectedRecipe(recipe);
                setCheckedIngredientsLocal({});
              }}
              className="border-primary/10 bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group flex flex-col h-full"
            >
              {/* Photo de couverture */}
              <div className="relative aspect-video w-full bg-muted overflow-hidden">
                {recipe.hero_image_url ? (
                  <img
                    src={recipe.hero_image_url}
                    alt={recipe.title}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground/40">
                    <Utensils className="h-10 w-10" />
                  </div>
                )}
                {recipe.difficulty && (
                  <span className="absolute top-3 left-3 bg-background/90 backdrop-blur-xs text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs">
                    {recipe.difficulty}
                  </span>
                )}
              </div>

              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
                    {recipe.title}
                  </h3>
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {recipe.description}
                    </p>
                  )}
                </div>

                {/* Métadonnées en bas */}
                <div className="mt-4 pt-3 border-t border-muted/50 flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(recipe.prep_time || recipe.cook_time) && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {recipe.prep_time || '0'} min
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1">
                        <Utensils className="h-3 w-3" />
                        {recipe.servings} pers.
                      </span>
                    )}
                    {recipe.wine_pairing && (
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                        <Wine className="h-3 w-3" />
                        {recipe.wine_pairing}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-muted px-2 py-0.5 rounded-md text-[9px] font-medium text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 3 && (
                        <span className="bg-muted px-1.5 py-0.5 rounded-md text-[9px] font-medium text-muted-foreground">
                          +{recipe.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 1. FICHE DETAIL DE LA RECETTE (Bottom Sheet) */}
      <Sheet open={!!selectedRecipe} onOpenChange={(open) => !open && setSelectedRecipe(null)}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-2xl mx-auto p-0">
          {selectedRecipe && (
            <div className="flex flex-col h-full">
              {/* Image Hero avec boutons de fermeture/action intégrés */}
              <div className="relative w-full aspect-video sm:aspect-21/9 bg-muted">
                {selectedRecipe.hero_image_url ? (
                  <img
                    src={selectedRecipe.hero_image_url}
                    alt={selectedRecipe.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground/30">
                    <Utensils className="h-16 w-16" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                      {selectedRecipe.title}
                    </h2>
                  </div>
                </div>
                
                {/* Bouton de fermeture Sheet */}
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-xs transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Contenu de la fiche */}
              <div className="p-5 space-y-6 flex-1">
                {/* Infos rapides & Tags */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {selectedRecipe.difficulty && (
                      <span className="font-bold border px-2.5 py-1 rounded-full bg-muted/40">
                        {selectedRecipe.difficulty}
                      </span>
                    )}
                    {selectedRecipe.prep_time && (
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Préparation : {selectedRecipe.prep_time}
                      </span>
                    )}
                    {selectedRecipe.cook_time && (
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Cuisson : {selectedRecipe.cook_time}
                      </span>
                    )}
                    {selectedRecipe.servings && (
                      <span className="flex items-center gap-1 font-semibold">
                        <Utensils className="h-3.5 w-3.5 text-muted-foreground" /> Portions : {selectedRecipe.servings} pers.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditForm(selectedRecipe)} className="h-8">
                      <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(selectedRecipe.id)} className="h-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {selectedRecipe.wine_pairing && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 p-3.5 text-sm text-rose-700 dark:text-rose-300">
                    <Wine className="h-5 w-5 shrink-0" />
                    <div>
                      <span className="font-bold">Accord vin conseillé : </span>
                      <span>{selectedRecipe.wine_pairing}</span>
                    </div>
                  </div>
                )}

                {selectedRecipe.description && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">Description</h4>
                    <p className="text-sm text-foreground/95 leading-relaxed">{selectedRecipe.description}</p>
                  </div>
                )}

                {/* Bouton ajouter aux courses */}
                <Button onClick={() => openAddToCart(selectedRecipe)} className="w-full h-10 font-bold bg-primary text-primary-foreground flex items-center justify-center gap-2">
                  <ShoppingBag className="h-5 w-5" /> Ajouter les ingrédients aux courses
                </Button>

                {/* INGREDIENTS */}
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-foreground border-b pb-1">Ingrédients</h3>
                  <div className="grid gap-2">
                    {selectedRecipe.ingredients.map((ing, i) => {
                      const isChecked = checkedIngredientsLocal[i] || false;
                      return (
                        <div
                          key={i}
                          onClick={() => setCheckedIngredientsLocal({ ...checkedIngredientsLocal, [i]: !isChecked })}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-muted/40 border-muted-foreground/20 opacity-70'
                              : 'bg-card border-primary/10 hover:border-primary/20'
                          }`}
                        >
                          <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-primary/30'
                          }`}>
                            {isChecked && <Check className="h-3 w-3" />}
                          </div>
                          <span className={`text-sm font-semibold ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {ing.qty && `${ing.qty} `}
                            {ing.unit && `${ing.unit} `}
                            {ing.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ETAPES DE PREPARATION */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-base font-bold text-foreground border-b pb-1">Préparation</h3>
                  <div className="space-y-4">
                    {selectedRecipe.steps.map((step, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-xl border bg-card/60">
                        {/* Numéro de l'étape */}
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="space-y-2 flex-1 min-w-0">
                          {step.title && <h4 className="font-bold text-sm text-foreground">{step.title}</h4>}
                          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{step.desc}</p>
                          {step.photo && (
                            <div className="mt-3 rounded-lg overflow-hidden max-h-48 max-w-sm bg-muted border">
                              <img src={step.photo} alt={`Étape ${i + 1}`} className="object-cover w-full h-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 2. BOÎTE DE DIALOGUE D'AJOUT DES INGREDIENTS AUX COURSES (Bottom Sheet) */}
      <Sheet open={isAddToCartOpen} onOpenChange={setIsAddToCartOpen}>
        <SheetContent side="bottom" className="h-[75vh] overflow-y-auto rounded-t-2xl sm:max-w-md mx-auto p-5">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" /> Ajouter aux courses
            </SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Choisir le rayon de destination</Label>
              <select
                value={cartRayon}
                onChange={(e) => setCartRayon(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                {['Épicerie', 'Frais', 'Boissons', 'Hygiène', 'Sans catégorie'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Sélectionner les ingrédients à ajouter</Label>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {cartIngredients.map((ing, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const updated = [...cartIngredients];
                      updated[i].checked = !ing.checked;
                      setCartIngredients(updated);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer"
                  >
                    <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${
                      ing.checked ? 'bg-primary border-primary text-primary-foreground' : 'border-primary/30'
                    }`}>
                      {ing.checked && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <span className="text-xs font-semibold leading-tight">{ing.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCartIngredients(cartIngredients.map((i) => ({ ...i, checked: true })));
                }}
              >
                Tout cocher
              </Button>
              <Button
                className="flex-1"
                disabled={addToCartMutation.isPending || cartIngredients.every(i => !i.checked)}
                onClick={handleAddSelectedToCart}
              >
                Ajouter la sélection
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 3. FORMULAIRE DE CREATION/EDITION DE RECETTE (Bottom Sheet) */}
      <Sheet open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl sm:max-w-2xl mx-auto p-0">
          <SheetHeader className="p-5 border-b sticky top-0 bg-background/95 backdrop-blur-xs z-10 flex flex-row items-center justify-between">
            <SheetTitle>
              {editingRecipe ? 'Modifier la recette' : 'Nouvelle recette'}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={closeForm} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-6">
            {/* Infos de base */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titre de la recette *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Tarte aux pommes de Mamie"
                  {...register('title')}
                  disabled={isSubmitting}
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description / Note</Label>
                <Input
                  id="description"
                  placeholder="Ex: Une tarte croustillante et caramélisée..."
                  {...register('description')}
                  disabled={isSubmitting}
                />
              </div>

              {/* Image de couverture */}
              <div className="space-y-1.5">
                <Label>Image de couverture</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="file"
                    accept="image/*"
                    ref={heroFileInputRef}
                    onChange={handleHeroImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingHero || isSubmitting}
                    onClick={() => heroFileInputRef.current?.click()}
                    className="h-8"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    {uploadingHero ? 'Envoi...' : 'Téléverser une image'}
                  </Button>
                  {watchedHeroUrl && (
                    <div className="h-10 w-16 rounded-md overflow-hidden border">
                      <img src={watchedHeroUrl} alt="Aperçu" className="object-cover w-full h-full" />
                    </div>
                  )}
                </div>
              </div>

              {/* Difficultés & Portions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Difficulté</Label>
                  <select
                    {...register('difficulty')}
                    className="w-full h-8 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="servings">Portions (pers.)</Label>
                  <Input
                    id="servings"
                    placeholder="Ex: 4"
                    {...register('servings')}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Temps prépa & cuisson */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prep_time">Temps de prépa (min)</Label>
                  <Input
                    id="prep_time"
                    placeholder="Ex: 15"
                    {...register('prep_time')}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cook_time">Temps de cuisson (min)</Label>
                  <Input
                    id="cook_time"
                    placeholder="Ex: 25"
                    {...register('cook_time')}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wine_pairing">Accord vin</Label>
                <Input
                  id="wine_pairing"
                  placeholder="Ex: Cidre brut ou Sauternes"
                  {...register('wine_pairing')}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Tags de formulaire */}
            <div className="space-y-2">
              <Label>Catégories / Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map((tag) => {
                  const isSelected = watchedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTagInForm(tag)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-muted/40 hover:bg-muted border-transparent text-muted-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EDITEUR D'INGREDIENTS */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-1">
                <Label className="text-base font-bold">Ingrédients *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => appendIngredient({ qty: '', unit: '', name: '' })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>

              {errors.ingredients && (
                <p className="text-xs text-destructive">{errors.ingredients.message}</p>
              )}

              <div className="space-y-2">
                {ingredientFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Input
                      placeholder="Qte"
                      className="w-14"
                      {...register(`ingredients.${index}.qty` as const)}
                      disabled={isSubmitting}
                    />
                    <Input
                      placeholder="Unité"
                      className="w-16"
                      {...register(`ingredients.${index}.unit` as const)}
                      disabled={isSubmitting}
                    />
                    <Input
                      placeholder="Nom de l'ingrédient"
                      className="flex-1"
                      {...register(`ingredients.${index}.name` as const)}
                      disabled={isSubmitting}
                    />
                    {ingredientFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(index)}
                        className="text-destructive h-8 w-8 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* EDITEUR D'ETAPES */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b pb-1">
                <Label className="text-base font-bold">Étapes de préparation *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => appendStep({ title: '', desc: '', photo: '' })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>

              {errors.steps && <p className="text-xs text-destructive">{errors.steps.message}</p>}

              <div className="space-y-4">
                {stepFields.map((field, index) => {
                  const stepPhoto = watchedSteps[index]?.photo;
                  return (
                    <div key={field.id} className="p-4 rounded-xl border bg-muted/10 space-y-3 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary">Étape {index + 1}</span>
                        {stepFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeStep(index)}
                            className="text-destructive h-7 w-7 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Input
                          placeholder="Titre de l'étape (facultatif)"
                          {...register(`steps.${index}.title` as const)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <textarea
                          placeholder="Description de l'étape..."
                          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50 min-h-20"
                          {...register(`steps.${index}.desc` as const)}
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Image d'étape */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            id={`step-file-${index}`}
                            onChange={(e) => handleStepImageUpload(e, index)}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingStepIndex !== null || isSubmitting}
                            onClick={() => document.getElementById(`step-file-${index}`)?.click()}
                            className="h-8"
                          >
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            {uploadingStepIndex === index ? 'Envoi...' : 'Ajouter une photo'}
                          </Button>
                          {stepPhoto && (
                            <div className="h-10 w-16 rounded-md overflow-hidden border relative">
                              <img src={stepPhoto} alt="Étape" className="object-cover w-full h-full" />
                              <button
                                type="button"
                                onClick={() => setValue(`steps.${index}.photo`, '')}
                                className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-10 font-bold">
              {isSubmitting ? 'Enregistrement...' : editingRecipe ? 'Enregistrer les modifications' : 'Créer la recette'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
