import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DollarSign,
  CreditCard,
  Clock,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Copy,
  TrendingUp,
  Receipt,
  Leaf,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const EDGE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/app_awo_payments` : '';

interface Payment {
  id: string;
  awo_id: string;
  client_id: string | null;
  consultation_id: string | null;
  ebo_id: string | null;
  payment_type: 'consultation' | 'ebo';
  amount: number;
  currency: string;
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_link_url: string | null;
  payment_link_expires_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  botanica_items: any[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentSummary {
  total_revenue: number;
  pending_amount: number;
  consultation_revenue: number;
  ebo_revenue: number;
  total_transactions: number;
  paid_count: number;
  pending_count: number;
  unpaid_count: number;
  refunded_count: number;
}

export default function AwoPayments() {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<PaymentSummary>({
    total_revenue: 0,
    pending_amount: 0,
    consultation_revenue: 0,
    ebo_revenue: 0,
    total_transactions: 0,
    paid_count: 0,
    pending_count: 0,
    unpaid_count: 0,
    refunded_count: 0,
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPayments, setTotalPayments] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [createType, setCreateType] = useState<'consultation' | 'ebo'>('consultation');

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formClientName, setFormClientName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!isSupabaseConfigured) {
      return { 'Authorization': '', 'Content-Type': 'application/json' };
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };
    } catch {
      return {
        'Authorization': '',
        'Content-Type': 'application/json',
      };
    }
  };

  const fetchSummary = useCallback(async () => {
    if (!isSupabaseConfigured || !EDGE_URL) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) return;
      const res = await fetch(`${EDGE_URL}?action=payment-summary`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data) setSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!isSupabaseConfigured || !EDGE_URL) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) return;
      const params = new URLSearchParams({
        action: 'list-payments',
        page: page.toString(),
        limit: '20',
      });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`${EDGE_URL}?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPayments(data?.payments || []);
        setTotalPayments(data?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
  }, [page, typeFilter, statusFilter]);

  const fetchPendingPayments = useCallback(async () => {
    if (!isSupabaseConfigured || !EDGE_URL) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) return;
      const res = await fetch(`${EDGE_URL}?action=pending-payments`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPendingPayments(data?.payments || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.allSettled([fetchSummary(), fetchPayments(), fetchPendingPayments()]);
      } catch (err) {
        console.error('Failed to load payment data:', err);
      }
      if (!cancelled) setLoading(false);
    };
    loadData();
    return () => { cancelled = true; };
  }, [fetchSummary, fetchPayments, fetchPendingPayments]);

  const handleCreatePayment = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const action = createType === 'consultation' ? 'create-consultation-payment' : 'create-ebo-payment';
      const body: Record<string, unknown> = {
        amount: formAmount,
        currency: formCurrency,
        client_name: formClientName,
      };

      if (createType === 'consultation') {
        body.consultation_id = crypto.randomUUID();
      } else {
        body.ebo_id = crypto.randomUUID();
      }

      const res = await fetch(`${EDGE_URL}?action=${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success('Payment record created successfully');
        setShowCreateDialog(false);
        setFormAmount('');
        setFormClientName('');
        setFormNotes('');
        await Promise.all([fetchSummary(), fetchPayments(), fetchPendingPayments()]);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create payment');
      }
    } catch {
      toast.error('Failed to create payment');
    }
    setActionLoading(false);
  };

  const handleGenerateLink = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_URL}?action=generate-payment-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ payment_id: paymentId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Payment link generated');
        await Promise.all([fetchPayments(), fetchPendingPayments()]);
        if (data.payment_link) {
          navigator.clipboard.writeText(data.payment_link);
          toast.success('Payment link copied to clipboard');
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate link');
      }
    } catch {
      toast.error('Failed to generate link');
    }
    setActionLoading(false);
  };

  const handleMarkPaid = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_URL}?action=mark-paid`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ payment_id: paymentId }),
      });

      if (res.ok) {
        toast.success('Payment marked as paid');
        await Promise.all([fetchSummary(), fetchPayments(), fetchPendingPayments()]);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to mark as paid');
      }
    } catch {
      toast.error('Failed to mark as paid');
    }
    setActionLoading(false);
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EDGE_URL}?action=refund`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ payment_id: selectedPayment.id, reason: refundReason }),
      });

      if (res.ok) {
        toast.success('Refund processed successfully');
        setShowRefundDialog(false);
        setSelectedPayment(null);
        setRefundReason('');
        await Promise.all([fetchSummary(), fetchPayments(), fetchPendingPayments()]);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to process refund');
      }
    } catch {
      toast.error('Failed to process refund');
    }
    setActionLoading(false);
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Payment link copied to clipboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unpaid</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'consultation'
      ? <Badge variant="outline" className="border-indigo-300 text-indigo-700">Consultation</Badge>
      : <Badge variant="outline" className="border-green-300 text-green-700">Ebo</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-['Rubik']">Payments</h1>
              <p className="text-sm text-gray-500">Manage consultation and Ebo payments</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-indigo-700 hover:bg-indigo-800 text-white"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            New Payment
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(summary?.total_revenue || 0, 'USD')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(summary?.pending_amount || 0, 'USD')}
                  </p>
                  <p className="text-xs text-gray-400">{summary?.pending_count || 0} payments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Receipt className="h-5 w-5 text-indigo-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Consultations</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(summary?.consultation_revenue || 0, 'USD')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ebo Payments</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(summary?.ebo_revenue || 0, 'USD')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
            <TabsTrigger value="pending">Pending ({summary?.pending_count || 0} + {summary?.unpaid_count || 0})</TabsTrigger>
            <TabsTrigger value="ebo">Ebo Payments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                      <p>No transactions yet</p>
                      <p className="text-sm">Create your first payment to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payments.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded ${p.payment_type === 'consultation' ? 'bg-indigo-100' : 'bg-green-100'}`}>
                              {p.payment_type === 'consultation'
                                ? <Receipt className="h-4 w-4 text-indigo-700" />
                                : <Leaf className="h-4 w-4 text-green-700" />
                              }
                            </div>
                            <div>
                              <p className="text-sm font-medium">{p.notes || `${p.payment_type} payment`}</p>
                              <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(p.amount, p.currency)}</p>
                            {getStatusBadge(p.payment_status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { setCreateType('consultation'); setShowCreateDialog(true); }}
                  >
                    <Receipt className="h-4 w-4 mr-3 text-indigo-600" />
                    Create Consultation Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { setCreateType('ebo'); setShowCreateDialog(true); }}
                  >
                    <Leaf className="h-4 w-4 mr-3 text-green-600" />
                    Create Ebo Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('pending')}
                  >
                    <Clock className="h-4 w-4 mr-3 text-amber-600" />
                    View Pending Payments ({(summary?.pending_count || 0) + (summary?.unpaid_count || 0)})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('history')}
                  >
                    <CreditCard className="h-4 w-4 mr-3 text-gray-600" />
                    Full Transaction History
                  </Button>
                </CardContent>
              </Card>

              {/* Status Breakdown */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Payment Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-emerald-700">{summary?.paid_count || 0}</p>
                      <p className="text-sm text-gray-600">Paid</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <Clock className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-amber-700">{summary?.pending_count || 0}</p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-700">{summary?.unpaid_count || 0}</p>
                      <p className="text-sm text-gray-600">Unpaid</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <XCircle className="h-6 w-6 text-gray-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-700">{summary?.refunded_count || 0}</p>
                      <p className="text-sm text-gray-600">Refunded</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transaction History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Transaction History</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="ebo">Ebo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No transactions found</p>
                    <p className="text-sm">Adjust filters or create a new payment</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b text-left text-sm text-gray-500">
                            <th className="pb-3 font-medium">Date</th>
                            <th className="pb-3 font-medium">Description</th>
                            <th className="pb-3 font-medium">Type</th>
                            <th className="pb-3 font-medium">Amount</th>
                            <th className="pb-3 font-medium">Status</th>
                            <th className="pb-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-3 text-sm">{formatDate(p.created_at)}</td>
                              <td className="py-3 text-sm font-medium">{p.notes || `${p.payment_type} payment`}</td>
                              <td className="py-3">{getTypeBadge(p.payment_type)}</td>
                              <td className="py-3 text-sm font-semibold">{formatCurrency(p.amount, p.currency)}</td>
                              <td className="py-3">{getStatusBadge(p.payment_status)}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  {p.payment_status === 'unpaid' && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => handleGenerateLink(p.id)} disabled={actionLoading}>
                                        <Send className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleMarkPaid(p.id)} disabled={actionLoading}>
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                  {p.payment_status === 'pending' && p.stripe_payment_link_url && (
                                    <Button size="sm" variant="ghost" onClick={() => copyLink(p.stripe_payment_link_url!)}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {p.payment_status === 'paid' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600"
                                      onClick={() => { setSelectedPayment(p); setShowRefundDialog(true); }}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPayments > 20 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-500">
                          Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, totalPayments)} of {totalPayments}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            Previous
                          </Button>
                          <Button size="sm" variant="outline" disabled={page * 20 >= totalPayments} onClick={() => setPage(p => p + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Payments Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending & Unpaid Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingPayments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No pending or unpaid payments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${p.payment_status === 'pending' ? 'bg-amber-100' : 'bg-red-100'}`}>
                            {p.payment_status === 'pending'
                              ? <Clock className="h-5 w-5 text-amber-700" />
                              : <AlertCircle className="h-5 w-5 text-red-700" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.notes || `${p.payment_type} payment`}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getTypeBadge(p.payment_type)}
                              {getStatusBadge(p.payment_status)}
                              <span className="text-xs text-gray-500">{formatDate(p.created_at)}</span>
                            </div>
                            {p.stripe_payment_link_url && (
                              <div className="flex items-center gap-1 mt-1">
                                <ExternalLink className="h-3 w-3 text-blue-500" />
                                <a
                                  href={p.stripe_payment_link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
                                >
                                  Payment Link
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold">{formatCurrency(p.amount, p.currency)}</p>
                          <div className="flex flex-col gap-1">
                            {p.payment_status === 'unpaid' && (
                              <>
                                <Button size="sm" onClick={() => handleGenerateLink(p.id)} disabled={actionLoading}>
                                  <Send className="h-3 w-3 mr-1" /> Send Link
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleMarkPaid(p.id)} disabled={actionLoading}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Mark Paid
                                </Button>
                              </>
                            )}
                            {p.payment_status === 'pending' && (
                              <>
                                {p.stripe_payment_link_url && (
                                  <Button size="sm" variant="outline" onClick={() => copyLink(p.stripe_payment_link_url!)}>
                                    <Copy className="h-3 w-3 mr-1" /> Copy Link
                                  </Button>
                                )}
                                <Button size="sm" onClick={() => handleGenerateLink(p.id)} disabled={actionLoading}>
                                  <RefreshCw className="h-3 w-3 mr-1" /> Resend
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ebo Payments Tab */}
          <TabsContent value="ebo">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Ebo Payments</CardTitle>
                  <Button size="sm" onClick={() => { setCreateType('ebo'); setShowCreateDialog(true); }}>
                    <Leaf className="h-4 w-4 mr-2" /> New Ebo Payment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {payments.filter(p => p.payment_type === 'ebo').length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Leaf className="h-12 w-12 mx-auto mb-3 text-green-200" />
                    <p className="font-medium">No Ebo payments</p>
                    <p className="text-sm">Ebo payments will appear here when created from consultations</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.filter(p => p.payment_type === 'ebo').map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Leaf className="h-5 w-5 text-green-700" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.notes || 'Ebo Payment'}</p>
                            <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
                            {p.botanica_items && p.botanica_items.length > 0 && (
                              <p className="text-xs text-green-600 mt-1">
                                {p.botanica_items.length} Botanica item(s)
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(p.amount, p.currency)}</p>
                            {getStatusBadge(p.payment_status)}
                          </div>
                          {p.payment_status === 'unpaid' && (
                            <Button size="sm" onClick={() => handleGenerateLink(p.id)} disabled={actionLoading}>
                              <Send className="h-3 w-3" />
                            </Button>
                          )}
                          {p.payment_status === 'paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => { setSelectedPayment(p); setShowRefundDialog(true); }}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Payment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create {createType === 'consultation' ? 'Consultation' : 'Ebo'} Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Payment Type</Label>
              <Select value={createType} onValueChange={(v) => setCreateType(v as 'consultation' | 'ebo')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="ebo">Ebo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client Name (optional)</Label>
              <Input
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Add any notes about this payment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePayment} disabled={actionLoading} className="bg-indigo-700 hover:bg-indigo-800 text-white">
              {actionLoading ? 'Creating...' : 'Create Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPayment && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">{selectedPayment.notes || 'Payment'}</p>
                <p className="text-lg font-bold mt-1">
                  {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Paid on {selectedPayment.paid_at ? formatDate(selectedPayment.paid_at) : 'N/A'}
                </p>
              </div>
            )}
            <div>
              <Label>Refund Reason</Label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund..."
                rows={3}
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                This action cannot be undone. The payment will be refunded via Stripe if applicable.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRefundDialog(false); setSelectedPayment(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleRefund}
              disabled={actionLoading}
              variant="destructive"
            >
              {actionLoading ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}