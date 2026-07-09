import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES, DBOrder } from '@/lib/supabase';
import { toast } from 'sonner';

function formatPrice(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';
  const { user } = useAuth();
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuccess) {
      toast.success('Payment successful! Your order has been placed.');
    }
  }, [isSuccess]);

  useEffect(() => {
    if (user) fetchOrders();
    else setLoading(false);
  }, [user]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.orders)
        .select('*')
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOrders(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {isSuccess && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-4 p-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Order Confirmed!</h3>
                <p className="text-sm text-green-700">Thank you for your purchase. You will receive a confirmation email shortly.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <h1 className="text-3xl font-heading font-bold mb-8">My Orders</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-5 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground">Your order history will appear here after your first purchase.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                    <Badge variant={getStatusColor(order.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="font-bold">{formatPrice(order.total_amount, order.currency || 'USD')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}