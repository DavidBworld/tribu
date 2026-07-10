import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Home, Calendar, ShoppingCart, BookOpen, FileText, LogOut, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [familyName, setFamilyName] = useState<string>('Ma Tribu');
  const [familyId, setFamilyId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadFamilyInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('family_members')
        .select('family_id, families(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membership) {
        setFamilyId(membership.family_id);
        const name = (membership.families as any)?.name;
        if (name) setFamilyName(name);
      }
    }

    loadFamilyInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCopyCode = async () => {
    if (!familyId) return;
    try {
      await navigator.clipboard.writeText(familyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur de copie:', err);
    }
  };

  const navItems = [
    { label: 'Flux', path: '/', icon: Home },
    { label: 'Agenda', path: '/agenda', icon: Calendar },
    { label: 'Courses', path: '/courses', icon: ShoppingCart },
    { label: 'Cuisine', path: '/cuisine', icon: BookOpen },
    { label: 'Docs', path: '/docs', icon: FileText },
  ];

  return (
    <div className="flex h-screen flex-col md:flex-row bg-background text-foreground pb-16 md:pb-0">
      {/* Mobile Topbar (Static, compact and header info without hamburger menu) */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-2.5 md:hidden shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-extrabold text-primary truncate max-w-[150px]" title={familyName}>
            {familyName}
          </span>
          {familyId && (
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/80 transition-colors"
              title="Copier le code de la famille"
            >
              <span>Code</span>
              {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
            </button>
          )}
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          title="Déconnexion"
        >
          <LogOut size={16} />
        </Button>
      </header>

      {/* Desktop Sidebar (Left side, hidden on mobile) */}
      <aside className="hidden w-64 flex-col border-r bg-card px-4 py-6 md:flex shrink-0">
        <div className="mb-8">
          <h1 className="text-xl font-extrabold tracking-tight text-primary truncate" title={familyName}>
            {familyName}
          </h1>
          {familyId && (
            <div className="mt-2 flex items-center gap-1 rounded bg-muted p-1 text-[11px] text-muted-foreground">
              <span className="flex-1 truncate font-mono" title={familyId}>
                ID: {familyId}
              </span>
              <button
                onClick={handleCopyCode}
                className="rounded p-1 hover:bg-card hover:text-foreground transition-colors"
                title="Copier le code de famille"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-4">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="flex w-full justify-start gap-3 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut size={18} />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Fixed bottom, hidden on desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-card md:hidden shadow-lg pb-safe">
        <div className="grid w-full grid-cols-5 items-center justify-items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
