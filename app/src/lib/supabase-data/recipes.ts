import { supabase } from '@/lib/supabase';

export interface RecipeIngredient {
  qty?: string;
  unit?: string;
  name: string;
}

export interface RecipeStep {
  title?: string;
  desc: string;
  photo?: string | null;
}

export interface Recipe {
  id: string;
  family_id: string;
  title: string;
  description?: string | null;
  prep_time?: string | null;
  cook_time?: string | null;
  servings?: string | null;
  wine_pairing?: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
  difficulty?: string | null;
  hero_image_url?: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export async function dbListRecipes(familyId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erreur de chargement des recettes : ${error.message}`);
  }

  return data as Recipe[];
}

export async function dbCreateRecipe(
  recipe: Omit<Recipe, 'id' | 'created_by' | 'created_at' | 'updated_at'>
): Promise<Recipe> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Utilisateur non connecté.');
  }

  const { data, error } = await supabase
    .from('recipes')
    .insert([
      {
        ...recipe,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur de création de la recette : ${error.message}`);
  }

  return data as Recipe;
}

export async function dbUpdateRecipe(
  id: string,
  recipe: Partial<Omit<Recipe, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update({
      ...recipe,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur de modification de la recette : ${error.message}`);
  }

  return data as Recipe;
}

export async function dbDeleteRecipe(id: string): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erreur de suppression de la recette : ${error.message}`);
  }
}

export async function dbUploadRecipeImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const fileName = `${randomStr}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from('recipes')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Erreur lors du téléversement de l'image : ${error.message}`);
  }

  const { data } = supabase.storage
    .from('recipes')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
