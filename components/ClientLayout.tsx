import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ClientNavigation } from './ClientNavigation';

export function ClientLayout() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/client/auth', { replace: true });
      return;
    }

    // Allow client role or any authenticated user accessing client portal
    if (userRole && userRole !== 'client' && userRole !== 'anon') {
      // If user has a non-client role, they might still access client portal
      // Only redirect if explicitly not allowed
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-indigo-200 rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <ClientNavigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
}