import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, ExternalLink } from 'lucide-react';
import { supabase, TABLES } from '@/lib/supabase';
import { toast } from 'sonner';

interface PaymentRow {
  id: string;
  buyer_id: string | null;
  total_amount: number;
  currency: string | null;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  buyer_name?: string;
  type?: string;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.orders)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with buyer names
      const buyerIds = [...new Set((data || []).map((p) => p.buyer_id).filter(Boolean))];
      const buyerMap: Record<string, string> = {};

      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from(TABLES.profiles)
          .select('id, full_name, email')
          .in('id', buyerIds as string[]);

        (profiles || []).forEach((p) => {
          buyerMap[p.id] = p.full_name || p.email?.split('@')[0] || 'Unknown';
        });
      }

      const enriched: PaymentRow[] = (data || []).map((p) => ({
        ...p,
        buyer_name: p.buyer_id ? buyerMap[p.buyer_id] || 'Unknown' : 'Guest',
        type: p.notes?.includes('ebo') ? 'Ebo' : p.notes?.includes('botanica') ? 'Botanica' : 'Consultation',
      }));

      setPayments(enriched);
    } catch (err) {
      console.error('Error fetching payments:', err);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'refunded':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = (p.buyer_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (showDetail && selectedPayment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Payment Detail</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Amount</span>
                <span className="text-sm font-bold text-lg">
                  ${(selectedPayment.total_amount / 100).toFixed(2)} {selectedPayment.currency?.toUpperCase() || 'USD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={getStatusColor(selectedPayment.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                  {selectedPayment.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Type</span>
                <span className="text-sm font-medium">{selectedPayment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Client</span>
                <span className="text-sm font-medium">{selectedPayment.buyer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm font-medium">
                  {new Date(selectedPayment.created_at).toLocaleString()}
                </span>
              </div>
              {selectedPayment.notes && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Notes</span>
                  <span className="text-sm font-medium">{selectedPayment.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stripe Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Session ID</span>
                <span className="text-xs font-mono text-gray-600 truncate max-w-[200px]">
                  {selectedPayment.stripe_session_id || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Payment Intent</span>
                <span className="text-xs font-mono text-gray-600 truncate max-w-[200px]">
                  {selectedPayment.stripe_payment_intent_id || 'N/A'}
                </span>
              </div>

              {selectedPayment.stripe_payment_intent_id && (
                <div className="pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        `https://dashboard.stripe.com/test/payments/${selectedPayment.stripe_payment_intent_id}`,
                        '_blank'
                      )
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View in Stripe Dashboard
                  </Button>
                </div>
              )}

              <p className="text-xs text-gray-400 italic pt-2">
                Phase 2: Manual reconciliation trigger will be available here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments Management</h1>
        <Badge variant="outline">{payments.length} total</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by client name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No payments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stripe Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{p.type}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{p.buyer_name}</td>
                      <td className="px-4 py-3 font-medium">${(p.total_amount / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusColor(p.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 truncate max-w-[100px]">
                        {p.stripe_payment_intent_id || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPayment(p);
                            setShowDetail(true);
                          }}
                        >
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