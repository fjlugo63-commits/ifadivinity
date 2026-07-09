import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

export default function ClientAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      if (!isSupabaseConfigured) {
        toast.success('Login successful!');
        navigate('/client/dashboard', { replace: true });
        return;
      }

      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError) {
          setError(authError.message);
          toast.error('Authentication failed: ' + authError.message);
          setTimeout(() => navigate('/client/auth', { replace: true }), 3000);
          return;
        }

        if (data.session) {
          // Ensure profile has client role
          const { data: profile } = await supabase
            .from('app_340b9f1944_profiles')
            .select('role')
            .eq('id', data.session.user.id)
            .single();

          if (!profile) {
            // Create profile with client role
            await supabase.from('app_340b9f1944_profiles').upsert({
              id: data.session.user.id,
              email: data.session.user.email,
              full_name: data.session.user.user_metadata?.full_name || '',
              role: 'client',
            });
          }

          toast.success('Login successful! Welcome back.');
          navigate('/client/dashboard', { replace: true });
        } else {
          setError('No session found. Please try logging in again.');
          setTimeout(() => navigate('/client/auth', { replace: true }), 3000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred');
        setTimeout(() => navigate('/client/auth', { replace: true }), 3000);
      }
    }

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <p className="text-xs text-gray-400">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Sparkles className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Verifying your login...</h2>
            <p className="text-sm text-gray-600">Please wait while we authenticate you.</p>
          </>
        )}
      </div>
    </div>
  );
}