import { supabase } from '../supabase';

export interface Family {
  id: string;
  name: string;
  created_at?: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'member';
  display_name: string | null;
  created_at?: string;
  families?: Family;
}

/**
 * Crée une nouvelle famille et associe l'utilisateur connecté comme administrateur de cette famille.
 */
export async function dbCreateFamily(name: string, displayName: string): Promise<FamilyMember> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Utilisateur non connecté.');
  }

  // 1. Insérer la famille
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert([{ name }])
    .select()
    .single();

  if (familyError || !family) {
    throw new Error(`Erreur lors de la création de la famille : ${familyError?.message}`);
  }

  // 2. Insérer le membre créateur (role: admin)
  const { data: member, error: memberError } = await supabase
    .from('family_members')
    .insert([
      {
        family_id: family.id,
        user_id: user.id,
        role: 'admin',
        display_name: displayName,
      },
    ])
    .select('*, families(*)')
    .single();

  if (memberError || !member) {
    // Si l'insertion du membre échoue, on tente de nettoyer la famille créée
    await supabase.from('families').delete().eq('id', family.id);
    throw new Error(`Erreur lors de l'association à la famille : ${memberError?.message}`);
  }

  return member as unknown as FamilyMember;
}

/**
 * Permet à l'utilisateur connecté de rejoindre une famille existante en fournissant son family_id.
 */
export async function dbJoinFamily(familyId: string, displayName: string): Promise<FamilyMember> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Utilisateur non connecté.');
  }

  // Vérifier si la famille existe d'abord
  const { data: family, error: checkError } = await supabase
    .from('families')
    .select('id')
    .eq('id', familyId)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Erreur de validation de la famille : ${checkError.message}`);
  }
  if (!family) {
    throw new Error('Code de famille invalide ou famille introuvable.');
  }

  const { data: member, error: memberError } = await supabase
    .from('family_members')
    .insert([
      {
        family_id: familyId,
        user_id: user.id,
        role: 'member',
        display_name: displayName,
      },
    ])
    .select('*, families(*)')
    .single();

  if (memberError || !member) {
    throw new Error(`Impossible de rejoindre cette famille : ${memberError?.message}`);
  }

  return member as unknown as FamilyMember;
}

/**
 * Récupère l'information de membre et de famille de l'utilisateur connecté.
 */
export async function dbGetFamilyMembership(): Promise<FamilyMember | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('family_members')
    .select('*, families(*)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erreur lors du chargement de la famille :', error);
    return null;
  }

  return data as unknown as FamilyMember;
}

/**
 * Liste tous les membres d'une famille spécifique.
 */
export async function dbListFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId);

  if (error) {
    throw new Error(`Erreur lors du chargement des membres de la famille : ${error.message}`);
  }

  return data as unknown as FamilyMember[];
}
