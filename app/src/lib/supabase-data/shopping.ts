import { supabase } from '@/lib/supabase';

export interface ShoppingItem {
  id: string;
  family_id: string;
  name: string;
  rayon: string;
  done: boolean;
  added_by?: string | null;
  created_at?: string;
  family_members?: {
    display_name: string | null;
  } | null;
}

export async function dbListShoppingItems(familyId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*, family_members(display_name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Erreur de chargement des courses : ${error.message}`);
  }

  return data as any[];
}

export async function dbCreateShoppingItem(
  name: string,
  rayon: string,
  familyId: string,
  memberId?: string | null
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .insert([
      {
        name,
        rayon,
        family_id: familyId,
        added_by: memberId || null,
        done: false,
      },
    ])
    .select('*, family_members(display_name)')
    .single();

  if (error) {
    throw new Error(`Erreur de création de l'article : ${error.message}`);
  }

  return data as any;
}

export async function dbUpdateShoppingItem(
  id: string,
  data: Partial<Omit<ShoppingItem, 'id' | 'family_id' | 'created_at'>>
): Promise<ShoppingItem> {
  const { data: updated, error } = await supabase
    .from('shopping_items')
    .update(data)
    .eq('id', id)
    .select('*, family_members(display_name)')
    .single();

  if (error) {
    throw new Error(`Erreur de modification de l'article : ${error.message}`);
  }

  return updated as any;
}

export async function dbDeleteShoppingItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erreur de suppression de l'article : ${error.message}`);
  }
}

export async function dbAddIngredientsToShopping(
  familyId: string,
  memberId: string | null,
  items: Array<{ name: string; rayon: string }>
): Promise<void> {
  if (items.length === 0) return;

  const insertData = items.map((item) => ({
    family_id: familyId,
    name: item.name,
    rayon: item.rayon,
    added_by: memberId || null,
    done: false,
  }));

  const { error } = await supabase
    .from('shopping_items')
    .insert(insertData);

  if (error) {
    throw new Error(`Erreur lors de l'ajout en lot des ingrédients : ${error.message}`);
  }
}
