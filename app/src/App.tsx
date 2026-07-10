import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthGuard from '@/components/AuthGuard';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import Flux from '@/pages/Flux';
import Agenda from '@/pages/Agenda';
import Courses from '@/pages/Courses';
import Cuisine from '@/pages/Cuisine';
import Docs from '@/pages/Docs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Page de connexion (Publique mais protégée si déjà connecté via redirection interne) */}
          <Route
            path="/login"
            element={
              <AuthGuard>
                <Login />
              </AuthGuard>
            }
          />

          {/* Étape d'onboarding famille obligatoire */}
          <Route
            path="/onboarding"
            element={
              <AuthGuard>
                <Onboarding />
              </AuthGuard>
            }
          />

          {/* Pages principales de l'application (Toutes sous le layout et protégées par AuthGuard) */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Flux />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="courses" element={<Courses />} />
            <Route path="cuisine" element={<Cuisine />} />
            <Route path="docs" element={<Docs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
