import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mail, UserPlus, Sparkles, Shield } from 'lucide-react';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function ClientAuth() {
  const { signInWithMagicLink, registerClient, user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTimezone, setRegTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Redirect if already authenticated as client
  if (!loading && user && (userRole === 'client' || userRole === 'buyer')) {
    navigate('/client/dashboard', { replace: true });
    return null;
  }

  // Block non-client roles
  if (!loading && user && userRole !== 'client' && userRole !== 'buyer' && userRole !== 'anon') {
    navigate('/', { replace: true });
    return null;
  }

  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setLoginLoading(true);
    const { error } = await signInWithMagicLink(loginEmail.trim());
    setLoginLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to send magic link');
    } else {
      setMagicLinkSent(true);
      toast.success('Magic link sent! Check your email inbox.');
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setRegLoading(true);
    const { error } = await registerClient({
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim() || undefined,
      timezone: regTimezone,
    });
    setRegLoading(false);
    if (error) {
      toast.error(error.message || 'Registration failed');
    } else {
      setRegSuccess(true);
      toast.success('Registration successful! Check your email for the login link.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-[Rubik]">Client Portal</h1>
          <p className="text-gray-600 mt-2 font-[Nunito_Sans]">Access your consultations, bookings, and spiritual journey</p>
        </div>

        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-amber-50/80">
              <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Mail className="h-4 w-4 mr-2" />
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Register
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="mt-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Welcome Back</CardTitle>
                <CardDescription>Sign in with your email — no password needed</CardDescription>
              </CardHeader>
              <CardContent>
                {magicLinkSent ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                      <Mail className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      We sent a magic link to <strong>{loginEmail}</strong>. Click the link in the email to sign in.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => { setMagicLinkSent(false); setLoginEmail(''); }}
                      className="rounded-xl"
                    >
                      Try a different email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email Address</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      disabled={loginLoading}
                    >
                      {loginLoading ? 'Sending...' : 'Send Magic Link'}
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-gray-500 justify-center mt-3">
                      <Shield className="h-3 w-3" />
                      <span>Secure, passwordless authentication</span>
                    </div>
                  </form>
                )}
              </CardContent>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="mt-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Create Account</CardTitle>
                <CardDescription>Register to access your spiritual consultations</CardDescription>
              </CardHeader>
              <CardContent>
                {regSuccess ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                      <Mail className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Registration Complete!</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Check your email at <strong>{regEmail}</strong> for a login link to access your dashboard.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => { setRegSuccess(false); setRegName(''); setRegEmail(''); setRegPhone(''); }}
                      className="rounded-xl"
                    >
                      Register another account
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full Name *</Label>
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Your full name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email Address *</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="your@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-phone">Phone Number</Label>
                      <Input
                        id="reg-phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-timezone">Timezone</Label>
                      <Select value={regTimezone} onValueChange={setRegTimezone}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      disabled={regLoading}
                    >
                      {regLoading ? 'Registering...' : 'Create Account'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          Are you a practitioner?{' '}
          <a href="/auth" className="text-amber-600 hover:underline font-medium">Sign in to Awo Portal</a>
        </p>
      </div>
    </div>
  );
}