import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Flag } from 'lucide-react';
import { supabase, TABLES } from '@/lib/supabase';
import { toast } from 'sonner';

interface AdminClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  status: string;
  created_at: string;
  awo_id: string;
  total_consultations?: number;
  total_payments?: number;
  last_activity?: string;
  is_test?: boolean;
}

export default function AdminClients() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [consultations, setConsultations] = useState<Array<{ id: string; status: string; created_at: string }>>([]);
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; status: string; created_at: string }>>([]);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.clients)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched: AdminClient[] = (data || []).map((c) => ({
        ...c,
        total_consultations: 0,
        total_payments: 0,
        last_activity: c.updated_at || c.created_at,
        is_test: (c as Record<string, unknown>).is_test === true,
      }));

      setClients(enriched);
    } catch (err) {
      console.error('Error fetching clients:', err);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  async function viewClientDetail(client: AdminClient) {
    setSelectedClient(client);
    setShowDetail(true);

    // Fetch related data
    const [consultRes, paymentRes] = await Promise.all([
      supabase.from(TABLES.consultations).select('id, status, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(10),
      supabase.from(TABLES.orders).select('id, total_amount, status, created_at').eq('buyer_id', client.id).order('created_at', { ascending: false }).limit(10),
    ]);

    setConsultations(consultRes.data || []);
    setPayments((paymentRes.data || []).map((p) => ({ id: p.id, amount: p.total_amount, status: p.status, created_at: p.created_at })));
  }

  async function toggleTestFlag(client: AdminClient) {
    const newVal = !client.is_test;
    const { error } = await supabase
      .from(TABLES.clients)
      .update({ is_test: newVal } as Record<string, unknown>)
      .eq('id', client.id);

    if (error) {
      toast.error('Failed to update test flag');
      return;
    }

    toast.success(newVal ? 'Marked as test account' : 'Removed test flag');
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, is_test: newVal } : c)));
    if (selectedClient?.id === client.id) {
      setSelectedClient({ ...selectedClient, is_test: newVal });
    }
  }

  const filteredClients = clients.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (showDetail && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Client Detail</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-medium">{selectedClient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium">{selectedClient.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm font-medium">{selectedClient.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Timezone</span>
                <span className="text-sm font-medium">{selectedClient.timezone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={selectedClient.status === 'active' ? 'default' : 'secondary'}>
                  {selectedClient.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Test Account</span>
                <Badge variant={selectedClient.is_test ? 'destructive' : 'outline'}>
                  {selectedClient.is_test ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Joined</span>
                <span className="text-sm font-medium">
                  {new Date(selectedClient.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="pt-4 border-t">
                <Button
                  size="sm"
                  variant={selectedClient.is_test ? 'outline' : 'destructive'}
                  onClick={() => toggleTestFlag(selectedClient)}
                >
                  <Flag className="w-4 h-4 mr-1" />
                  {selectedClient.is_test ? 'Remove Test Flag' : 'Mark as Test'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Consultations ({consultations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {consultations.length === 0 ? (
                  <p className="text-sm text-gray-500">No consultations</p>
                ) : (
                  <div className="space-y-2">
                    {consultations.map((c) => (
                      <div key={c.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                        <Badge variant="outline">{c.status}</Badge>
                        <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments ({payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-gray-500">No payments</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                        <span className="text-sm font-medium">${(p.amount / 100).toFixed(2)}</span>
                        <Badge variant="outline">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients Management</h1>
        <Badge variant="outline">{clients.length} total</Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Timezone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Activity</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {client.name}
                        {client.is_test && (
                          <Badge variant="destructive" className="ml-2 text-xs">Test</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{client.email || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{client.timezone}</td>
                      <td className="px-4 py-3">
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                          {client.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {client.last_activity ? new Date(client.last_activity).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => viewClientDetail(client)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}