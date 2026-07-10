import { supabase } from '../supabase';

export interface AgendaEvent {
  id: string;
  family_id: string;
  title: string;
  event_date: string; // Format "YYYY-MM-DD"
  all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  phone?: string | null;
  notes?: string | null;
  assigned_member_id?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  family_members?: {
    id: string;
    display_name: string | null;
    role: string;
    user_id: string;
  } | null;
}

/**
 * Récupère tous les événements de l'agenda pour une famille donnée.
 */
export async function dbListEvents(familyId: string): Promise<AgendaEvent[]> {
  const { data, error } = await supabase
    .from('agenda_events')
    .select('*, family_members(id, display_name, role, user_id)')
    .eq('family_id', familyId)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error(`Erreur de chargement des événements : ${error.message}`);
  }

  return data as unknown as AgendaEvent[];
}

/**
 * Crée un nouvel événement d'agenda.
 */
export async function dbCreateEvent(
  event: Omit<AgendaEvent, 'id' | 'created_by' | 'created_at' | 'updated_at'>
): Promise<AgendaEvent> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Utilisateur non connecté.');
  }

  const { data, error } = await supabase
    .from('agenda_events')
    .insert([
      {
        ...event,
        created_by: user.id,
      },
    ])
    .select('*, family_members(id, display_name, role, user_id)')
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création de l'événement : ${error.message}`);
  }

  return data as unknown as AgendaEvent;
}

/**
 * Met à jour un événement d'agenda existant.
 */
export async function dbUpdateEvent(
  id: string,
  event: Partial<Omit<AgendaEvent, 'id' | 'created_by' | 'created_at' | 'updated_at'>>
): Promise<AgendaEvent> {
  const { data, error } = await supabase
    .from('agenda_events')
    .update({
      ...event,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, family_members(id, display_name, role, user_id)')
    .single();

  if (error) {
    throw new Error(`Erreur lors de la modification de l'événement : ${error.message}`);
  }

  return data as unknown as AgendaEvent;
}

/**
 * Supprime un événement d'agenda.
 */
export async function dbDeleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('agenda_events')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Erreur lors de la suppression de l'événement : ${error.message}`);
  }
}
