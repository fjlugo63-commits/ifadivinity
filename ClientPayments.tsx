import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Receipt,
  DollarSign,
  Calendar,
  User,
  AlertCircle,
  LogOut,
  Bell,
  RotateCcw,
  FileText,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

// ============ TYPES ============
interface ClientPayment {
  id: string;
  type: 'consultation' | 'ebo' | 'botanica';
  amount: number;
  currency: string;
  status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  awo_name: string;
  consultation_date: string | null;
  consultation_id: string | null;
  ebo_id: string | null;
  order_id: string | null;
  stripe_payment_link: string | null;
  stripe_reference: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_amount: number | null;
  description: string;
  created_at: string;
}

// ============ MOCK DATA ============
const MOCK_PAYMENTS: ClientPayment[] = [
  {
    id: 'pay-1',
    type: 'consultation',
    amount: 150.00,
    currency: 'USD',
    status: 'unpaid',
    awo_name: 'Babalawo Adeyemi',
    consultation_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    consultation_id: 'consult-123',
    ebo_id: null,
    order_id: null,
    stripe_payment_link: 'https://checkout.stripe.com/pay/cs_test_example1',
    stripe_reference: null,
    receipt_url: null,
    paid_at: null,
    refunded_at: null,
    refund_amount: null,
    description: 'Dafa (Full) Consultation',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-2',
    type: 'consultation',
    amount: 75.00,
    currency: 'USD',
    status: 'pending',
    awo_name: 'Iyanifa Oluwaseun',
    consultation_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    consultation_id: 'consult-456',
    ebo_id: null,
    order_id: null,
    stripe_payment_link: 'https://checkout.stripe.com/pay/cs_test_example2',
    stripe_reference: 'pi_3abc123',
    receipt_url: null,
    paid_at: null,
    refunded_at: null,
    refund_amount: null,
    description: 'Follow-up Consultation',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-3',
    type: 'ebo',
    amount: 250.00,
    currency: 'USD',
    status: 'paid',
    awo_name: 'Babalawo Adeyemi',
    consultation_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    consultation_id: 'consult-789',
    ebo_id: 'ebo-001',
    order_id: null,
    stripe_payment_link: null,
    stripe_reference: 'pi_3def456',
    receipt_url: 'https://pay.stripe.com/receipts/example3',
    paid_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    refunded_at: null,
    refund_amount: null,
    description: 'Ebo Riru - Ogun Offering',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-4',
    type: 'botanica',
    amount: 45.00,
    currency: 'USD',
    status: 'paid',
    awo_name: 'Marketplace',
    consultation_date: null,
    consultation_id: null,
    ebo_id: null,
    order_id: 'order-001',
    stripe_payment_link: null,
    stripe_reference: 'pi_3ghi789',
    receipt_url: 'https://pay.stripe.com/receipts/example4',
    paid_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    refunded_at: null,
    refund_amount: null,
    description: 'Botanica Order #1001',
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-5',
    type: 'consultation',
    amount: 150.00,
    currency: 'USD',
    status: 'refunded',
    awo_name: 'Babalawo Adeyemi',
    consultation_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    consultation_id: 'consult-old',
    ebo_id: null,
    order_id: null,
    stripe_payment_link: null,
    stripe_reference: 'pi_3jkl012',
    receipt_url: 'https://pay.stripe.com/receipts/example5',
    paid_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    refunded_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    refund_amount: 150.00,
    description: 'Dafa (Full) Consultation - Cancelled',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============ API HELPER ============
// Fetches payments directly from Supabase orders table for the current user
async function fetchClientPaymentsFromDB(userId: string): Promise<ClientPayment[]> {
  if (!isSupabaseConfigured || !userId) {
    return [];
  }

  try {
    // Query orders table for this user's payments
    const { data: orders, error } = await supabase
      .from('app_340b9f1944_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    // Map orders to ClientPayment format
    return orders.map((order: Record<string, unknown>) => ({
      id: (order.id as string) || crypto.randomUUID(),
      type: ((order.type as string) || 'consultation') as 'consultation' | 'ebo' | 'botanica',
      amount: (order.total_amount as number) || (order.amount as number) || 0,
      currency: (order.currency as string) || 'USD',
      status: mapOrderStatus((order.status as string) || 'pending'),
      awo_name: (order.seller_name as string) || (order.awo_name as string) || 'Practitioner',
      consultation_date: (order.consultation_date as string) || null,
      consultation_id: (order.consultation_id as string) || null,
      ebo_id: (order.ebo_id as string) || null,
      order_id: (order.id as string) || null,
      stripe_payment_link: (order.stripe_payment_link as string) || (order.payment_link as string) || null,
      stripe_reference: (order.stripe_payment_intent as string) || (order.stripe_reference as string) || null,
      receipt_url: (order.receipt_url as string) || null,
      paid_at: (order.paid_at as string) || null,
      refunded_at: (order.refunded_at as string) || null,
      refund_amount: (order.refund_amount as number) || null,
      description: (order.description as string) || (order.item_name as string) || `Order #${(order.id as string)?.slice(0, 8) || ''}`,
      created_at: (order.created_at as string) || new Date().toISOString(),
    }));
  } catch (err) {
    console.error('Failed to query payments from DB:', err);
    return [];
  }
}

function mapOrderStatus(status: string): 'unpaid' | 'pending' | 'paid' | 'refunded' {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'completed':
    case 'fulfilled':
      return 'paid';
    case 'pending':
    case 'processing':
      return 'pending';
    case 'refunded':
    case 'cancelled':
      return 'refunded';
    default:
      return 'unpaid';
  }
}

// ============ STATUS BADGE ============
function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return (
        <Badge className="bg-green-100 text-green-700 rounded-full text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 rounded-full text-xs gap-1">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
    case 'unpaid':
      return (
        <Badge className="bg-red-100 text-red-700 rounded-full text-xs gap-1">
          <XCircle className="h-3 w-3" /> Unpaid
        </Badge>
      );
    case 'refunded':
      return (
        <Badge className="bg-gray-100 text-gray-700 rounded-full text-xs gap-1">
          <RotateCcw className="h-3 w-3" /> Refunded
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="rounded-full text-xs">{status}</Badge>;
  }
}

// ============ TYPE ICON ============
function PaymentTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'consultation':
      return <Calendar className="h-4 w-4 text-indigo-600" />;
    case 'ebo':
      return <Sparkles className="h-4 w-4 text-amber-600" />;
    case 'botanica':
      return <ShoppingBag className="h-4 w-4 text-green-600" />;
    default:
      return <CreditCard className="h-4 w-4 text-gray-600" />;
  }
}

// ============ PAYMENT STATUS VIEWER ============
function PaymentStatusViewer({
  payments,
  loading,
  onOpenLink,
  onViewDetail,
}: {
  payments: ClientPayment[];
  loading: boolean;
  onOpenLink: (payment: ClientPayment) => void;
  onViewDetail: (payment: ClientPayment) => void;
}) {
  const actionablePayments = payments.filter(p => p.status === 'unpaid' || p.status === 'pending');

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (actionablePayments.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">All payments up to date!</p>
        <p className="text-xs text-gray-400 mt-1">No pending or unpaid items</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {actionablePayments.map((payment) => (
          <Card
            key={payment.id}
            className={`rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
              payment.status === 'unpaid' ? 'bg-red-50/50 border-l-4 border-l-red-400' : 'bg-amber-50/50 border-l-4 border-l-amber-400'
            }`}
            onClick={() => onViewDetail(payment)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    payment.type === 'consultation' ? 'bg-indigo-100' :
                    payment.type === 'ebo' ? 'bg-amber-100' : 'bg-green-100'
                  }`}>
                    <PaymentTypeIcon type={payment.type} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{payment.description}</p>
                    <p className="text-xs text-gray-500">{payment.awo_name}</p>
                  </div>
                </div>
                <PaymentStatusBadge status={payment.status} />
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900">
                    ${payment.amount.toFixed(2)}
                  </span>
                  {payment.consultation_date && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(payment.consultation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                {payment.stripe_payment_link && (
                  <Button
                    size="sm"
                    className="h-8 text-xs rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLink(payment);
                    }}
                  >
                    <CreditCard className="h-3 w-3 mr-1" /> Pay Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============ PAYMENT HISTORY ============
function PaymentHistory({
  payments,
  loading,
  onViewDetail,
}: {
  payments: ClientPayment[];
  loading: boolean;
  onViewDetail: (payment: ClientPayment) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No payment history yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Date</div>
        </div>
        <Separator />
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors items-center"
            onClick={() => onViewDetail(payment)}
          >
            <div className="col-span-4 flex items-center gap-2">
              <PaymentTypeIcon type={payment.type} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{payment.description}</p>
                <p className="text-[10px] text-gray-400">{payment.awo_name}</p>
              </div>
            </div>
            <div className="col-span-2">
              <Badge variant="outline" className="text-[10px] rounded-full capitalize">
                {payment.type}
              </Badge>
            </div>
            <div className="col-span-2">
              <span className="text-sm font-semibold">${payment.amount.toFixed(2)}</span>
              <span className="text-[10px] text-gray-400 ml-1">{payment.currency}</span>
            </div>
            <div className="col-span-2">
              <PaymentStatusBadge status={payment.status} />
            </div>
            <div className="col-span-2 text-xs text-gray-500">
              {new Date(payment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============ PAYMENT DETAIL DIALOG ============
function PaymentDetailDialog({
  payment,
  open,
  onClose,
  onOpenLink,
}: {
  payment: ClientPayment | null;
  open: boolean;
  onClose: () => void;
  onOpenLink: (payment: ClientPayment) => void;
}) {
  const navigate = useNavigate();

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            Payment Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount & Status */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">${payment.amount.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{payment.currency}</p>
            <div className="mt-2">
              <PaymentStatusBadge status={payment.status} />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Description</span>
              <span className="text-sm font-medium">{payment.description}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Type</span>
              <Badge variant="outline" className="text-xs rounded-full capitalize">{payment.type}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Practitioner</span>
              <span className="text-sm flex items-center gap-1">
                <User className="h-3 w-3" /> {payment.awo_name}
              </span>
            </div>
            {payment.consultation_date && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Consultation Date</span>
                  <span className="text-sm">
                    {new Date(payment.consultation_date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                </div>
              </>
            )}
            {payment.stripe_reference && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Stripe Reference</span>
                  <span className="text-xs font-mono text-gray-600">{payment.stripe_reference}</span>
                </div>
              </>
            )}
            {payment.paid_at && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Paid At</span>
                  <span className="text-sm text-green-700">
                    {new Date(payment.paid_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                    })}
                  </span>
                </div>
              </>
            )}
            {payment.status === 'refunded' && (
              <>
                <Separator />
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Refund Information</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Refund Amount</span>
                    <span className="text-sm font-semibold text-gray-700">
                      ${payment.refund_amount != null ? payment.refund_amount.toFixed(2) : '0.00'}
                    </span>
                  </div>
                  {payment.refunded_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Refunded At</span>
                      <span className="text-xs text-gray-600">
                        {new Date(payment.refunded_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {(payment.status === 'unpaid' || payment.status === 'pending') && payment.stripe_payment_link && (
              <Button
                size="sm"
                className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                onClick={() => onOpenLink(payment)}
              >
                <CreditCard className="h-3 w-3 mr-1" /> Pay Now
              </Button>
            )}
            {payment.receipt_url && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => window.open(payment.receipt_url!, '_blank')}
              >
                <FileText className="h-3 w-3 mr-1" /> View Receipt
              </Button>
            )}
            {payment.consultation_id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => navigate(`/consultation/${payment.consultation_id}`)}
              >
                <Calendar className="h-3 w-3 mr-1" /> View Consultation
              </Button>
            )}
            {payment.order_id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => navigate('/orders')}
              >
                <ShoppingBag className="h-3 w-3 mr-1" /> View Order
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PAGE ============
export default function ClientPayments() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<ClientPayment | null>(null);
  const [pollingPaymentId, setPollingPaymentId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safety timeout - if auth takes too long, just show the page with mock data
  useEffect(() => {
    if (authLoading) {
      const safetyTimeout = setTimeout(() => {
        if (isMountedRef.current && loading) {
          // Auth is taking too long - show page with mock data
          setPayments(MOCK_PAYMENTS);
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(safetyTimeout);
    }
  }, [authLoading, loading]);

  const fetchPayments = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);

    if (!isSupabaseConfigured || !user) {
      // No Supabase or no user - show mock/demo data
      setPayments(MOCK_PAYMENTS);
      setLoading(false);
      return;
    }

    try {
      const dbPayments = await fetchClientPaymentsFromDB(user.id);
      if (isMountedRef.current) {
        if (dbPayments.length > 0) {
          setPayments(dbPayments);
        } else {
          // No payments found in DB - show mock data as demo
          setPayments(MOCK_PAYMENTS);
        }
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      if (isMountedRef.current) {
        // Graceful fallback to mock data
        setPayments(MOCK_PAYMENTS);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPayments();
    } else if (!authLoading) {
      // Auth finished but no user - show mock data (don't redirect)
      setPayments(MOCK_PAYMENTS);
      setLoading(false);
    }
  }, [user, authLoading, fetchPayments]);

  // Polling for payment status - simplified and safe
  useEffect(() => {
    if (!pollingPaymentId) return;

    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 60; // Max 3 minutes of polling (every 3s)

    const poll = async () => {
      if (cancelled || !isMountedRef.current) return;
      pollCount++;

      if (pollCount > maxPolls) {
        // Stop polling after max attempts
        if (isMountedRef.current) {
          toast.info('Payment check timed out. Refresh the page to see updated status.');
          setPollingPaymentId(null);
        }
        return;
      }

      if (!isSupabaseConfigured) {
        // Mock: simulate payment completion after ~5 seconds (2 poll cycles)
        if (pollCount >= 2 && isMountedRef.current) {
          setPayments(prev => prev.map(p =>
            p.id === pollingPaymentId
              ? { ...p, status: 'paid' as const, paid_at: new Date().toISOString(), stripe_reference: 'pi_mock_completed' }
              : p
          ));
          toast.success('Payment completed!', { description: 'Your payment has been processed successfully.' });
          setPollingPaymentId(null);
        } else if (isMountedRef.current && !cancelled) {
          pollingRef.current = setTimeout(poll, 3000);
        }
        return;
      }

      try {
        if (user) {
          // Query the specific payment from DB to check status
          const { data: orderData, error } = await supabase
            .from('app_340b9f1944_orders')
            .select('*')
            .eq('id', pollingPaymentId)
            .eq('user_id', user.id)
            .single();

          if (!error && orderData && !cancelled && isMountedRef.current) {
            const orderStatus = mapOrderStatus((orderData.status as string) || 'pending');
            if (orderStatus === 'paid' || orderStatus === 'refunded') {
              setPayments(prev => prev.map(p =>
                p.id === pollingPaymentId
                  ? { ...p, status: orderStatus, paid_at: (orderData.paid_at as string) || new Date().toISOString() }
                  : p
              ));
              if (orderStatus === 'paid') {
                toast.success('Payment completed!', { description: 'Your payment has been processed successfully.' });
              }
              setPollingPaymentId(null);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Don't crash - just continue polling
      }

      // Schedule next poll
      if (!cancelled && isMountedRef.current) {
        pollingRef.current = setTimeout(poll, 3000);
      }
    };

    // Start first poll after a short delay
    pollingRef.current = setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollingPaymentId, navigate, user]);

  function handleOpenPaymentLink(payment: ClientPayment) {
    if (!payment.stripe_payment_link) {
      toast.error('No payment link available');
      return;
    }

    // Open Stripe link in new tab
    window.open(payment.stripe_payment_link, '_blank');
    toast.info('Payment link opened', { description: 'Complete payment in the new tab. Status will update automatically.' });

    // Start polling
    setPollingPaymentId(payment.id);
  }

  async function handleLogout() {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch {
      // Still navigate even if signOut fails
    }
    navigate('/client/auth', { replace: true });
  }

  // Don't block the entire page on auth loading - let the content render with loading states

  const unpaidCount = payments.filter(p => p.status === 'unpaid').length;
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Rubik]">Payments</h1>
          <p className="text-sm text-gray-500">View and manage your payment history</p>
        </div>
        <div className="flex items-center gap-2">
          {pollingPaymentId && (
            <Badge className="bg-amber-100 text-amber-700 rounded-full text-xs animate-pulse gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Checking payment...
            </Badge>
          )}
        </div>
      </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-2xl border-0 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{unpaidCount}</p>
                <p className="text-xs text-gray-500">Unpaid</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">${totalPaid.toFixed(0)}</p>
                <p className="text-xs text-gray-500">Total Paid</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action required banner */}
        {unpaidCount > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                {unpaidCount} payment{unpaidCount > 1 ? 's' : ''} require{unpaidCount === 1 ? 's' : ''} attention
              </p>
              <p className="text-xs text-red-600">Complete payment to confirm your consultation</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="status" className="space-y-4">
          <TabsList className="bg-white/80 rounded-xl shadow-sm p-1">
            <TabsTrigger value="status" className="rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
              <CreditCard className="h-4 w-4 mr-2" />
              Action Required
              {(unpaidCount + pendingCount) > 0 && (
                <Badge className="ml-2 bg-red-100 text-red-700 rounded-full text-[10px]">
                  {unpaidCount + pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
              <Receipt className="h-4 w-4 mr-2" />
              Payment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            <Card className="rounded-2xl border-0 shadow-md bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                  Payments Requiring Action
                </CardTitle>
                <CardDescription>Complete pending payments to confirm your consultations</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentStatusViewer
                  payments={payments}
                  loading={loading}
                  onOpenLink={handleOpenPaymentLink}
                  onViewDetail={(p) => setSelectedPayment(p)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="rounded-2xl border-0 shadow-md bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-amber-600" />
                      Payment History
                    </CardTitle>
                    <CardDescription>All your consultation, Ebo, and Botanica payments</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPayments}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PaymentHistory
                  payments={payments}
                  loading={loading}
                  onViewDetail={(p) => setSelectedPayment(p)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      {/* Payment Detail Dialog */}
      <PaymentDetailDialog
        payment={selectedPayment}
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onOpenLink={handleOpenPaymentLink}
      />
    </div>
  );
}