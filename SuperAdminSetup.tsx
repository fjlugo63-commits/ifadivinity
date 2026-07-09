import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import Header from '@/components/layout/Header';

export default function SuperAdminSetup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Super Admin');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    permissions?: Record<string, boolean>;
  } | null>(null);

  async function handleCreateSuperAdmin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      if (!isSupabaseConfigured) {
        toast.error('Supabase is not configured. Please connect your project first.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('app_seed_super_admin', {
        body: { email, password, name, secret },
      });

      if (error) {
        // Try to extract meaningful error from context
        let errorMessage = error.message || 'Unknown error occurred';
        try {
          if (error.context) {
            const ctx = typeof error.context.json === 'function' 
              ? await error.context.json() 
              : error.context;
            if (ctx?.error) errorMessage = ctx.error;
          }
        } catch {
          // Use original message
        }
        toast.error(`Failed: ${errorMessage}`);
        setResult({ success: false, message: errorMessage });
      } else if (data?.error) {
        toast.error(data.error);
        setResult({ success: false, message: data.error });
      } else if (data?.success) {
        toast.success(data.message || 'Super Admin created!');
        setResult({
          success: true,
          message: data.message,
          permissions: data.permissions,
        });
      } else {
        toast.error('Unexpected response from server');
        setResult({ success: false, message: 'Unexpected response format' });
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <Shield className="h-12 w-12 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl font-heading">Super Admin Setup</CardTitle>
            <CardDescription>
              Create or elevate an account to Super Admin with full platform access.
              This account can manage all user roles, permissions, and platform settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Display Name</Label>
                <Input
                  id="admin-name"
                  placeholder="Super Admin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Strong password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-secret">Admin Secret Key</Label>
                <Input
                  id="admin-secret"
                  type="password"
                  placeholder="Enter the super admin secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Default secret: <code className="bg-muted px-1 rounded">ifa-super-admin-2026</code>
                  <br />
                  Change this in your Supabase Edge Function environment variables (SUPER_ADMIN_SECRET).
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Super Admin...' : 'Create Super Admin Account'}
              </Button>
            </form>

            {result && (
              <div className={`mt-6 p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.message}
                  </span>
                </div>
                {result.permissions && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-green-800">Granted Permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.permissions).map(([key, value]) => (
                        <Badge
                          key={key}
                          variant={value === true ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {key.replace(/_/g, ' ').replace('can ', '✓ ')}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      You can now sign in with this account and access all platform features:
                      Admin Panel, Seller Dashboard, Bookings, Orders, and User Management.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium text-sm mb-2">Super Admin Capabilities:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Admin Panel</strong> — Manage all users, products, orders, refunds</li>
                <li>• <strong>Seller Dashboard</strong> — Create products & Egbo services (auto-verified)</li>
                <li>• <strong>Buyer Features</strong> — Browse, cart, checkout, bookings</li>
                <li>• <strong>Verify Sellers</strong> — Approve/revoke Egbo practitioner status</li>
                <li>• <strong>Audit Logs</strong> — View all platform activity</li>
                <li>• <strong>Refunds</strong> — Process refunds on any order</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}