import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, CheckCircle, AlertTriangle, Loader2, Send, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import Header from '@/components/layout/Header';

interface TestAccount {
  id?: string;
  email: string;
  full_name: string;
  role: string;
  is_test: boolean;
  created_at?: string;
}

interface CreateResult {
  email: string;
  role: string;
  status: string;
  userId?: string;
  error?: string;
}

const EXPECTED_ACCOUNTS = [
  { email: 'awo_test@ifadivinity.com', role: 'awo', name: 'Awo Test', house: 'House ID 1' },
  { email: 'client_test@ifadivinity.com', role: 'client', name: 'Client Test', house: null },
  { email: 'admin_test@ifadivinity.com', role: 'admin', name: 'Admin Test', house: null },
  { email: 'house_admin_test@ifadivinity.com', role: 'house_admin', name: 'House Admin Test', house: 'House ID 1' },
];

export default function SystemTestAccounts() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState<string | null>(null);
  const [existingAccounts, setExistingAccounts] = useState<TestAccount[]>([]);
  const [createResults, setCreateResults] = useState<CreateResult[] | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    fetchTestAccounts();
  }, []);

  async function fetchTestAccounts() {
    if (!isSupabaseConfigured) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase.functions.invoke('app_seed_test_users', {
        method: 'GET',
      });

      if (error) {
        console.warn('Failed to fetch test accounts:', error.message);
      } else if (data?.accounts) {
        setExistingAccounts(data.accounts);
      }
    } catch (err) {
      console.warn('Error fetching test accounts:', err);
    } finally {
      setLoadingList(false);
    }
  }

  async function handleCreateTestAccounts(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setCreateResults(null);
    setErrorDetail(null);

    try {
      if (!isSupabaseConfigured) {
        toast.error('Supabase is not configured. Please connect your project first.');
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke('app_seed_test_users', {
        body: { secret, action: 'create' },
      });

      const { data, error } = response;

      if (error) {
        let errorMessage = error.message || 'Unknown error occurred';
        let detail = '';
        try {
          // Try to extract context from FunctionsHttpError
          if (error.context) {
            if (typeof error.context.json === 'function') {
              const ctx = await error.context.json();
              if (ctx?.error) errorMessage = ctx.error;
              detail = JSON.stringify(ctx, null, 2);
            } else if (typeof error.context.text === 'function') {
              detail = await error.context.text();
            } else {
              detail = JSON.stringify(error.context, null, 2);
            }
          }
        } catch {
          detail = `Raw error: ${JSON.stringify(error, null, 2)}`;
        }
        setErrorDetail(`${errorMessage}\n\nDetails:\n${detail || 'No additional details available.'}`);
        toast.error(`Failed: ${errorMessage}`);
      } else if (data?.error) {
        setErrorDetail(`Server returned error: ${data.error}`);
        toast.error(data.error);
      } else if (data?.results) {
        setCreateResults(data.results);
        const successCount = data.results.filter((r: CreateResult) => r.status === 'created' || r.status === 'updated').length;
        const errorResults = data.results.filter((r: CreateResult) => r.status === 'error');
        if (errorResults.length > 0) {
          setErrorDetail(`Partial failure:\n${errorResults.map((r: CreateResult) => `• ${r.email}: ${r.error}`).join('\n')}`);
        }
        if (successCount === data.results.length) {
          toast.success(data.message || 'All test accounts created successfully!');
        } else {
          toast.warning(data.message || 'Some accounts had issues.');
        }
        // Refresh the list
        await fetchTestAccounts();
      } else {
        // Unexpected response shape
        setErrorDetail(`Unexpected response:\n${JSON.stringify(data, null, 2)}`);
        toast.error('Unexpected response from server');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setErrorDetail(`Exception: ${msg}\n\nStack: ${err?.stack || 'N/A'}`);
      toast.error(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMagicLink(email: string) {
    if (!isSupabaseConfigured || !secret) {
      toast.error('Please enter the secret key first.');
      return;
    }
    setSendingMagicLink(email);
    try {
      const { data, error } = await supabase.functions.invoke('app_seed_test_users', {
        body: { secret, action: 'send-magic-link', email },
      });

      if (error) {
        toast.error(`Failed to send magic link: ${error.message}`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Magic link sent to ${email}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSendingMagicLink(null);
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'awo': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'client': return 'bg-green-100 text-green-800 border-green-200';
      case 'house_admin': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'created': return <Badge className="bg-green-100 text-green-800">Created</Badge>;
      case 'updated': return <Badge className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">System Test Accounts</h1>
            <p className="text-sm text-muted-foreground">Create and manage MVP1 test users for development and testing</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Create Test Accounts
              </CardTitle>
              <CardDescription>
                Creates all 4 required MVP1 test users in one call. Existing accounts will be updated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTestAccounts} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-secret">Secret Key</Label>
                  <Input
                    id="test-secret"
                    type="password"
                    placeholder="Enter the test accounts secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: <code className="bg-muted px-1 rounded">ifa-test-accounts-2026</code>
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Accounts...
                    </>
                  ) : (
                    'Create All Test Accounts'
                  )}
                </Button>
              </form>

              {/* Expected accounts info */}
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Accounts to Create:</h4>
                <div className="space-y-2">
                  {EXPECTED_ACCOUNTS.map((acc) => (
                    <div key={acc.email} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getRoleBadgeColor(acc.role)}`}>
                          {acc.role}
                        </Badge>
                        {acc.house && (
                          <Badge variant="outline" className="text-xs">
                            {acc.house}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Default password: <code className="bg-muted px-1 rounded">TestAccount2026!</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results / Existing Accounts Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Test Accounts Status
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchTestAccounts}
                  disabled={loadingList}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <CardDescription>
                Currently registered test accounts in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingList ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : existingAccounts.length > 0 ? (
                <div className="space-y-3">
                  {existingAccounts.map((acc) => (
                    <div key={acc.id || acc.email} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{acc.full_name}</span>
                        <Badge className={`text-xs ${getRoleBadgeColor(acc.role)}`}>
                          {acc.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{acc.email}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSendMagicLink(acc.email)}
                          disabled={sendingMagicLink === acc.email || !secret}
                        >
                          {sendingMagicLink === acc.email ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Magic Link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No test accounts found</p>
                  <p className="text-xs mt-1">Create them using the form on the left</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Detail Panel */}
        {errorDetail && (
          <Card className="mt-6 border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  Error Details
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setErrorDetail(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  Dismiss
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-red-800 bg-red-100 p-3 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {errorDetail}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Creation Results */}
        {createResults && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Creation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {createResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {result.status === 'error' ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{result.email}</p>
                        {result.error && (
                          <p className="text-xs text-red-600 mt-0.5">{result.error}</p>
                        )}
                        {result.userId && (
                          <p className="text-xs text-muted-foreground mt-0.5">ID: {result.userId}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getRoleBadgeColor(result.role)}`}>
                        {result.role}
                      </Badge>
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2">Next Steps:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Sign in with any test account using the default password or magic link</li>
                  <li>• Awo Test: Access /awo/dashboard for consultation workspace</li>
                  <li>• Client Test: Access /client/dashboard for client portal</li>
                  <li>• Admin Test: Access /admin/dashboard for admin panel</li>
                  <li>• House Admin Test: Access /awo/house for house management</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}