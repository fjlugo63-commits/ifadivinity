import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error || !sessionData.session) {
          navigate('/auth/error');
          return;
        }

        const userId = sessionData.session.user.id;

        // Fetch user profile to determine role
        const { data: profile } = await supabase
          .from(TABLES.profiles)
          .select('role')
          .eq('id', userId)
          .single();

        const role = profile?.role || 'buyer';

        // Role-based redirect
        switch (role) {
          case 'awo':
            navigate('/awo', { replace: true });
            break;
          case 'client':
            navigate('/client', { replace: true });
            break;
          case 'admin':
          case 'super_admin':
          case 'seller':
            navigate('/admin', { replace: true });
            break;
          default:
            navigate('/', { replace: true });
            break;
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/auth/error');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-200 border-t-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
        <p className="text-sm text-gray-400 mt-2">Redirecting to your portal...</p>
      </div>
    </div>
  );
}