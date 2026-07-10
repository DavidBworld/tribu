import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { dbGetFamilyMembership, dbListFamilyMembers } from '@/lib/supabase-data/family';
import { dbListEvents, dbCreateEvent, dbUpdateEvent, dbDeleteEvent } from '@/lib/supabase-data/agenda';
import type { AgendaEvent } from '@/lib/supabase-data/agenda';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  FileText, 
  Trash2, 
  Edit, 
  X, 
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';

const eventFormSchema = z.object({
  title: z.string().min(1, 'Le titre de l\'événement est obligatoire'),
  event_date: z.string().min(1, 'La date est obligatoire'),
  all_day: z.boolean(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assigned_member_id: z.string().nullable().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const DAYS_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ==================== FONCTIONS UTILITAIRES DE MODULE ====================

const addOneHour = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const parseTimeToMinutes = (timeStr?: string | null) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};

const formatDateLong = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatIsoDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// ==================== COMPOSANT PRINCIPAL AGENDA ====================

export default function Agenda() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Navigation du calendrier
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  
  // États de contrôle des modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Charger la session utilisateur actuelle
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // Défilement automatique vers 07:00 pour la timeline semaine/jour
  useEffect(() => {
    if ((view === 'week' || view === 'day') && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 420;
    }
  }, [view]);

  // 1. Charger l'appartenance à la famille de l'utilisateur connecté
  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ['membership'],
    queryFn: dbGetFamilyMembership,
  });

  const familyId = membership?.family_id;

  // 2. Charger les membres de la famille
  const { data: familyMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['familyMembers', familyId],
    queryFn: () => dbListFamilyMembers(familyId!),
    enabled: !!familyId,
  });

  // 3. Charger les événements de la famille
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['events', familyId],
    queryFn: () => dbListEvents(familyId!),
    enabled: !!familyId,
  });

  // Initialisation du formulaire react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      event_date: new Date().toISOString().split('T')[0],
      all_day: true,
      start_time: '',
      end_time: '',
      location: '',
      phone: '',
      notes: '',
      assigned_member_id: '',
    }
  });

  const watchAllDay = watch('all_day');

  // Mutations CRUD
  const createMutation = useMutation({
    mutationFn: (newEvent: Omit<AgendaEvent, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => 
      dbCreateEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', familyId] });
      closeForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Erreur lors de la création de l\'événement.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AgendaEvent> }) => 
      dbUpdateEvent(id, data),
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['events', familyId] });
      if (selectedEvent?.id === updatedEvent.id) {
        setSelectedEvent(updatedEvent);
      }
      closeForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Erreur lors de la modification de l\'événement.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: dbDeleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', familyId] });
      setSelectedEvent(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Erreur lors de la suppression de l\'événement.');
    }
  });

  const openCreateForm = (defaultDate?: string, defaultHour?: string) => {
    setEditingEvent(null);
    setFormError(null);
    reset({
      title: '',
      event_date: defaultDate || new Date().toISOString().split('T')[0],
      all_day: !defaultHour,
      start_time: defaultHour || '',
      end_time: defaultHour ? addOneHour(defaultHour) : '',
      location: '',
      phone: '',
      notes: '',
      assigned_member_id: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (event: AgendaEvent) => {
    setEditingEvent(event);
    setFormError(null);
    reset({
      title: event.title,
      event_date: event.event_date,
      all_day: event.all_day,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      location: event.location || '',
      phone: event.phone || '',
      notes: event.notes || '',
      assigned_member_id: event.assigned_member_id || '',
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
    setFormError(null);
  };

  const onSubmit = (values: EventFormValues) => {
    if (!familyId) return;

    const payload = {
      family_id: familyId,
      title: values.title.trim(),
      event_date: values.event_date,
      all_day: values.all_day,
      start_time: values.all_day ? null : values.start_time || null,
      end_time: values.all_day ? null : values.end_time || null,
      location: values.location?.trim() || null,
      phone: values.phone?.trim() || null,
      notes: values.notes?.trim() || null,
      assigned_member_id: values.assigned_member_id || null,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (eventId: string) => {
    if (confirm('Voulez-vous vraiment supprimer cet événement ?')) {
      deleteMutation.mutate(eventId);
    }
  };

  // Style de couleur dynamique pour chaque membre de la famille connectée
  const getMemberColors = (memberId?: string | null) => {
    if (!memberId) {
      return { 
        bg: 'bg-muted/30', 
        text: 'text-muted-foreground',
        border: 'border-muted-foreground/30',
        dot: 'bg-muted-foreground/40' 
      };
    }
    const idx = familyMembers.findIndex(m => m.id === memberId);
    const colors = [
      { bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-900', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
      { bg: 'bg-teal-50 dark:bg-teal-950/20', border: 'border-teal-200 dark:border-teal-900', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
      { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-900', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
      { bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-900', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
      { bg: 'bg-indigo-50 dark:bg-indigo-950/20', border: 'border-indigo-200 dark:border-indigo-900', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' }
    ];
    return colors[idx % colors.length] || colors[0];
  };

  const getMemberName = (memberId?: string | null) => {
    if (!memberId) return 'Non assigné';
    const m = familyMembers.find(member => member.id === memberId);
    if (!m) return 'Non assigné';
    if (m.user_id === currentUser?.id) {
      return `${m.display_name || 'Moi'} (Moi)`;
    }
    return m.display_name || 'Membre sans nom';
  };

  // Période d'affichage de navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    const offset = direction === 'next' ? 1 : -1;
    const newDate = new Date(anchorDate);
    if (view === 'month') {
      newDate.setMonth(anchorDate.getMonth() + offset);
    } else if (view === 'week') {
      newDate.setDate(anchorDate.getDate() + offset * 7);
    } else {
      newDate.setDate(anchorDate.getDate() + offset);
    }
    setAnchorDate(newDate);
  };

  const setToday = () => {
    setAnchorDate(new Date());
  };

  const getPeriodLabel = () => {
    if (view === 'month') {
      return anchorDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
    } else if (view === 'week') {
      const mon = getMonday(anchorDate);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      if (mon.getMonth() === sun.getMonth()) {
        return `${mon.getDate()} - ${sun.getDate()} ${mon.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}`;
      }
      return `${mon.getDate()} ${mon.toLocaleDateString('fr-FR', { month: 'short' })} - ${sun.getDate()} ${sun.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`.toUpperCase();
    } else {
      return formatDateLong(formatIsoDate(anchorDate));
    }
  };

  const eventsForCurrentDate = (dateStr: string) => {
    return events.filter(e => e.event_date === dateStr);
  };

  const isLoading = loadingMembership || loadingMembers || loadingEvents;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* Barre d'actions supérieure */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Agenda</h2>
          <p className="text-muted-foreground mt-1">Gérez le calendrier partagé de votre tribu.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sélecteur de vue */}
          <div className="flex rounded-lg bg-muted p-0.5 text-xs font-semibold">
            <button
              onClick={() => setView('month')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                view === 'month' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setView('week')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                view === 'week' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setView('day')}
              className={`rounded-md px-3 py-1.5 transition-all ${
                view === 'day' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Jour
            </button>
          </div>

          <Button 
            onClick={() => openCreateForm()}
            className="bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 shadow-sm text-xs py-1.5 px-3 h-8"
          >
            <Plus className="h-4 w-4" /> Nouveau
          </Button>
        </div>
      </div>

      {/* Barre de navigation temporelle */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-8 text-xs px-3" onClick={setToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h3 className="font-bold text-sm tracking-wide text-foreground truncate max-w-[200px] sm:max-w-none">
          {getPeriodLabel()}
        </h3>
        <div className="w-20" /> {/* Espaceur pour équilibrer */}
      </div>

      {/* Grilles de calendrier */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {view === 'month' && (
            <MonthView 
              anchorDate={anchorDate} 
              events={events} 
              onSelectEvent={setSelectedEvent}
              onSelectDate={(d) => {
                setAnchorDate(d);
                setView('day');
              }}
              onEmptyClick={(d) => openCreateForm(formatIsoDate(d))}
              getMemberColors={getMemberColors}
            />
          )}

          {view === 'week' && (
            <WeekView 
              anchorDate={anchorDate}
              events={events}
              onSelectEvent={setSelectedEvent}
              onEmptyClick={(d, h) => openCreateForm(d, h)}
              getMemberColors={getMemberColors}
              scrollContainerRef={scrollContainerRef}
            />
          )}

          {view === 'day' && (
            <DayView 
              events={eventsForCurrentDate(formatIsoDate(anchorDate))}
              onSelectEvent={setSelectedEvent}
              onEmptyClick={(h) => openCreateForm(formatIsoDate(anchorDate), h)}
              getMemberColors={getMemberColors}
              scrollContainerRef={scrollContainerRef}
            />
          )}
        </div>

        {/* Panneau de détail latéral */}
        <div className="lg:col-span-1">
          {selectedEvent ? (
            <Card className="sticky top-6 border-primary/20 bg-card shadow-lg overflow-hidden transition-all duration-300">
              <div className="bg-primary/5 p-4 border-b border-muted flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4 text-primary" /> Détails de l'événement
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedEvent(null)}
                  className="h-8 w-8 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <CardContent className="p-5 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-1 leading-snug">{selectedEvent.title}</h2>
                  <p className="text-xs text-primary font-semibold flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatDateLong(selectedEvent.event_date)}
                  </p>
                </div>

                <div className="space-y-3.5 text-xs text-foreground/80">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="block font-medium text-muted-foreground">Horaire</span>
                      <span>
                        {selectedEvent.all_day 
                          ? 'Toute la journée' 
                          : `${selectedEvent.start_time}${selectedEvent.end_time ? ` à ${selectedEvent.end_time}` : ''}`}
                      </span>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="block font-medium text-muted-foreground">Lieu</span>
                        <span className="break-words">{selectedEvent.location}</span>
                      </div>
                    </div>
                  )}

                  {selectedEvent.phone && (
                    <div className="flex items-start gap-2.5">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="block font-medium text-muted-foreground">Téléphone</span>
                        <a 
                          href={`tel:${selectedEvent.phone}`} 
                          className="text-primary hover:underline font-semibold"
                        >
                          {selectedEvent.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="block font-medium text-muted-foreground">Assigné à</span>
                      <span className="font-semibold text-primary">{getMemberName(selectedEvent.assigned_member_id)}</span>
                    </div>
                  </div>
                </div>

                {selectedEvent.notes && (
                  <div className="pt-4 border-t border-muted">
                    <span className="block font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Observations
                    </span>
                    <p className="text-xs bg-muted/40 p-3 rounded-lg text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {selectedEvent.notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-muted">
                  <Button 
                    onClick={() => openEditForm(selectedEvent)}
                    variant="outline" 
                    className="flex-1 gap-1 text-xs h-8"
                  >
                    <Edit className="h-3.5 w-3.5" /> Modifier
                  </Button>
                  <Button 
                    onClick={() => handleDelete(selectedEvent.id)}
                    variant="destructive" 
                    className="flex-1 gap-1 text-xs h-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="hidden lg:block rounded-xl border border-dashed p-8 text-center text-muted-foreground bg-muted/10">
              <CalendarIcon className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-xs">Sélectionnez un événement pour voir ses détails ou cliquez sur un créneau vide pour l'ajouter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-all duration-200">
          <Card className="w-full max-w-md shadow-2xl border-primary/20 bg-card overflow-hidden">
            <div className="bg-primary/5 px-5 py-3.5 border-b border-muted flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={closeForm}
                className="h-8 w-8 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="title">Titre de l'événement *</Label>
                <Input 
                  id="title"
                  placeholder="Ex: Sortie piscine"
                  {...register('title')}
                  disabled={isSubmitting}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event_date">Date *</Label>
                <Input 
                  id="event_date"
                  type="date"
                  {...register('event_date')}
                  disabled={isSubmitting}
                />
                {errors.event_date && (
                  <p className="text-xs text-destructive">{errors.event_date.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  id="all_day"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary/50"
                  {...register('all_day')}
                  disabled={isSubmitting}
                />
                <Label htmlFor="all_day" className="cursor-pointer">Toute la journée</Label>
              </div>

              {!watchAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_time">Heure de début</Label>
                    <Input 
                      id="start_time"
                      type="time"
                      {...register('start_time')}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_time">Heure de fin</Label>
                    <Input 
                      id="end_time"
                      type="time"
                      {...register('end_time')}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Lieu</Label>
                  <Input 
                    id="location"
                    placeholder="Ex: École"
                    {...register('location')}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input 
                    id="phone"
                    placeholder="Ex: 06..."
                    {...register('phone')}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assigned_member_id">Membre assigné</Label>
                <select
                  id="assigned_member_id"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card"
                  {...register('assigned_member_id')}
                  disabled={isSubmitting}
                >
                  <option value="">- Non assigné -</option>
                  {familyMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.user_id === currentUser?.id
                        ? `${member.display_name || 'Moi'} (Moi)`
                        : member.display_name || 'Membre sans nom'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes / Observations</Label>
                <textarea
                  id="notes"
                  rows={2}
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Informations supplémentaires..."
                  {...register('notes')}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-muted">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="h-8 text-xs"
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 h-8 text-xs"
                  disabled={isSubmitting}
                >
                  <Check className="h-3.5 w-3.5" />
                  {isSubmitting ? 'Enregistrement...' : editingEvent ? 'Modifier' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

// ==================== VUE MOIS ====================
interface MonthViewProps {
  anchorDate: Date;
  events: AgendaEvent[];
  onSelectEvent: (e: AgendaEvent) => void;
  onSelectDate: (d: Date) => void;
  onEmptyClick: (d: Date) => void;
  getMemberColors: (id?: string | null) => { bg: string; text: string; border: string; dot: string };
}

function MonthView({ anchorDate, events, onSelectEvent, onSelectDate, onEmptyClick, getMemberColors }: MonthViewProps) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  let firstDayIndex = firstDayOfMonth.getDay();
  if (firstDayIndex === 0) firstDayIndex = 7;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const cells: { date: Date; currentMonth: boolean }[] = [];

  for (let i = firstDayIndex - 1; i > 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthTotalDays - i + 1),
      currentMonth: false
    });
  }

  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      date: new Date(year, month, i),
      currentMonth: true
    });
  }

  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: new Date(year, month + 1, i),
      currentMonth: false
    });
  }

  const formatKey = (d: Date) => d.toISOString().split('T')[0];

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <Card className="shadow-md border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAYS_NAMES.map(name => (
          <div key={name} className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase">
            {name.substring(0, 3)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-muted/10 divide-x divide-y divide-border border-b border-r">
        {cells.map(({ date, currentMonth }, idx) => {
          const dateStr = formatKey(date);
          const isToday = dateStr === todayStr;
          const dayEvents = events.filter(e => e.event_date === dateStr);

          return (
            <div 
              key={idx}
              className={`min-h-[90px] p-1.5 flex flex-col justify-between transition-colors relative group select-none ${
                currentMonth ? 'bg-card' : 'bg-muted/10 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => onSelectDate(date)}
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isToday 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  {date.getDate()}
                </button>
                {currentMonth && (
                  <button
                    onClick={() => onEmptyClick(date)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-muted text-muted-foreground"
                    title="Ajouter un événement"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 mt-1 space-y-1 overflow-y-auto max-h-[60px] scrollbar-none">
                {dayEvents.map(event => {
                  const colors = getMemberColors(event.assigned_member_id);
                  return (
                    <div 
                      key={event.id}
                      onClick={() => onSelectEvent(event)}
                      className={`text-[9px] px-1 py-0.5 rounded border cursor-pointer truncate font-medium transition-transform active:scale-[0.98] ${colors.bg} ${colors.text} ${colors.border}`}
                      title={event.title}
                    >
                      {event.start_time && !event.all_day && (
                        <span className="font-bold mr-0.5">{event.start_time}</span>
                      )}
                      {event.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ==================== VUE SEMAINE ====================
interface WeekViewProps {
  anchorDate: Date;
  events: AgendaEvent[];
  onSelectEvent: (e: AgendaEvent) => void;
  onEmptyClick: (date: string, hour: string) => void;
  getMemberColors: (id?: string | null) => { bg: string; text: string; border: string; dot: string };
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

function WeekView({ 
  anchorDate, 
  events, 
  onSelectEvent, 
  onEmptyClick, 
  getMemberColors, 
  scrollContainerRef 
}: WeekViewProps) {
  const mon = getMonday(anchorDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(d);
  }

  const formatKey = (d: Date) => d.toISOString().split('T')[0];

  const weekEventsByDate = days.map(d => {
    const dateStr = formatKey(d);
    const dayEvents = events.filter(e => e.event_date === dateStr);
    return {
      dateStr,
      allDay: dayEvents.filter(e => e.all_day),
      timed: dayEvents.filter(e => !e.all_day)
    };
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <Card className="shadow-md border overflow-hidden flex flex-col bg-card h-[680px]">
      <div className="grid grid-cols-8 border-b bg-muted/30 border-border text-center select-none shrink-0">
        <div className="border-r border-border py-3 flex items-center justify-center">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {days.map((d, i) => {
          const isToday = formatKey(d) === todayStr;
          return (
            <div key={i} className={`py-2 flex flex-col items-center justify-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{DAYS_NAMES[i].substring(0, 3)}</span>
              <span className={`text-sm font-extrabold mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ${
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
              }`}>
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-8 border-b border-border bg-muted/10 shrink-0 text-xs">
        <div className="py-2 px-1 text-center font-bold text-[9px] text-muted-foreground border-r border-border uppercase self-center">
          Jour entier
        </div>
        {weekEventsByDate.map(({ allDay }, i) => (
          <div key={i} className="p-1 border-r border-border last:border-r-0 min-h-[44px] space-y-1 flex flex-col justify-start">
            {allDay.map(event => {
              const colors = getMemberColors(event.assigned_member_id);
              return (
                <div 
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={`text-[9px] px-1 py-0.5 rounded border cursor-pointer font-bold truncate transition-transform active:scale-[0.98] ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {event.title}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative select-none"
      >
        <div className="grid grid-cols-8 min-h-[1440px] relative divide-x divide-border">
          <div className="col-span-1 bg-muted/10 border-r border-border relative">
            {hours.map(h => (
              <div 
                key={h} 
                className="h-[60px] flex items-start justify-center pt-1 border-b border-border/50 text-[10px] font-bold text-muted-foreground"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {weekEventsByDate.map(({ dateStr, timed }, dayIdx) => (
            <div key={dayIdx} className="col-span-1 relative bg-card/10 h-full border-r border-border last:border-r-0">
              {hours.map(h => {
                const hourStr = `${String(h).padStart(2, '0')}:00`;
                return (
                  <div
                    key={h}
                    onClick={() => onEmptyClick(dateStr, hourStr)}
                    className="h-[60px] border-b border-border/50 hover:bg-muted/20 cursor-crosshair transition-colors"
                  />
                );
              })}

              {timed.map(event => {
                const colors = getMemberColors(event.assigned_member_id);
                const startM = parseTimeToMinutes(event.start_time);
                const endM = event.end_time ? parseTimeToMinutes(event.end_time) : startM + 60;
                
                const top = startM;
                const height = Math.max(30, endM - startM);

                return (
                  <div
                    key={event.id}
                    onClick={() => onSelectEvent(event)}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className={`absolute left-1 right-1 p-1 rounded-md border text-[9px] leading-tight flex flex-col justify-start cursor-pointer shadow-sm overflow-hidden select-none hover:shadow-md transition-all active:scale-[0.98] border-l-4 ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    <span className="font-extrabold block truncate">
                      {event.start_time} {event.title}
                    </span>
                    {height > 40 && event.location && (
                      <span className="text-[8px] opacity-80 block truncate mt-0.5">
                        📍 {event.location}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ==================== VUE JOUR ====================
interface DayViewProps {
  events: AgendaEvent[];
  onSelectEvent: (e: AgendaEvent) => void;
  onEmptyClick: (hour: string) => void;
  getMemberColors: (id?: string | null) => { bg: string; text: string; border: string; dot: string };
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

function DayView({
  events,
  onSelectEvent,
  onEmptyClick,
  getMemberColors,
  scrollContainerRef
}: DayViewProps) {
  const allDayEvents = events.filter(e => e.all_day);
  const timedEvents = events.filter(e => !e.all_day);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card className="shadow-md border overflow-hidden flex flex-col bg-card h-[680px]">
      <div className="p-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
          <CalendarIcon className="h-4 w-4 text-primary" />
          Planning de la journée
        </span>
        <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
          {events.length} {events.length > 1 ? 'événements' : 'événement'}
        </span>
      </div>

      {allDayEvents.length > 0 && (
        <div className="p-3 border-b border-border bg-muted/10 space-y-2 shrink-0">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Toute la journée</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allDayEvents.map(event => {
              const colors = getMemberColors(event.assigned_member_id);
              return (
                <div 
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer shadow-sm transition-transform active:scale-[0.98] ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {event.title}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        <div className="grid grid-cols-6 min-h-[1440px] relative divide-x divide-border">
          <div className="col-span-1 bg-muted/10 border-r border-border relative">
            {hours.map(h => (
              <div 
                key={h} 
                className="h-[60px] flex items-start justify-center pt-1 border-b border-border/50 text-[10px] font-bold text-muted-foreground"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="col-span-5 relative bg-card/10 h-full">
            {hours.map(h => {
              const hourStr = `${String(h).padStart(2, '0')}:00`;
              return (
                <div
                  key={h}
                  onClick={() => onEmptyClick(hourStr)}
                  className="h-[60px] border-b border-border/50 hover:bg-muted/20 cursor-crosshair transition-colors"
                />
              );
            })}

            {timedEvents.map(event => {
              const colors = getMemberColors(event.assigned_member_id);
              const startM = parseTimeToMinutes(event.start_time);
              const endM = event.end_time ? parseTimeToMinutes(event.end_time) : startM + 60;
              
              const top = startM;
              const height = Math.max(30, endM - startM);

              return (
                <div
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  className={`absolute left-3 right-3 p-2 rounded-lg border text-xs leading-tight flex flex-col justify-start cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] border-l-4 overflow-hidden select-none ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  <span className="font-bold block truncate">
                    {event.start_time} - {event.end_time || addOneHour(event.start_time || '00:00')} : {event.title}
                  </span>
                  {height > 45 && event.location && (
                    <span className="text-[10px] opacity-80 block truncate mt-1">
                      📍 {event.location}
                    </span>
                  )}
                  {height > 60 && event.notes && (
                    <p className="text-[10px] opacity-75 mt-1 truncate">
                      📝 {event.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
