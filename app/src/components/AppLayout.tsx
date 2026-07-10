import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Home, Calendar, ShoppingCart, BookOpen, FileText, LogOut, Menu, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [familyName, setFamilyName] = useState<string>('Ma Tribu');
  const [familyId, setFamilyId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex h-screen flex-col md:flex-row bg-background text-foreground">
      {/* Mobile Topbar */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <span className="text-lg font-bold text-primary truncate max-w-[200px]">{familyName}</span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded p-1 hover:bg-muted focus:outline-none"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card px-4 py-6 md:flex">
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
                    ? 'bg-primary text-primary-foreground'
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

      {/* Mobile Nav Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-[53px] left-0 right-0 z-50 border-b bg-card px-4 py-4 shadow-lg md:hidden">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            <div className="border-t pt-2 mt-2">
              {familyId && (
                <div className="mb-2 flex items-center justify-between rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono">ID: {familyId}</span>
                  <button onClick={handleCopyCode} className="p-1 hover:text-foreground">
                    {copied ? 'Copié !' : <Copy size={14} />}
                  </button>
                </div>
              )}
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                variant="ghost"
                className="flex w-full justify-start gap-3 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={18} />
                Déconnexion
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
