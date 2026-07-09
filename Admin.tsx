import { useState, useEffect } from 'react';
import { Users, Package, ShoppingBag, AlertTriangle, ScrollText, ShieldCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES, DBProfile, DBOrder, DBProduct, DBBooking } from '@/lib/supabase';
import { fetchAuditLogs, AuditLog, logAudit } from '@/lib/audit';
import { toast } from 'sonner';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function AdminPage() {
  const { userRole } = useAuth();
  const [users, setUsers] = useState<DBProfile[]>([]);
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    const logs = await fetchAuditLogs(100);
    setAuditLogs(logs);
  }

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, ordersRes, productsRes, bookingsRes] = await Promise.all([
        supabase.from(TABLES.profiles).select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.orders).select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.products).select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.bookings).select('*').order('created_at', { ascending: false }),
      ]);
      if (usersRes.data) setUsers(usersRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (productsRes.data) {
        setProducts(productsRes.data);
        const sellerIds = [...new Set(productsRes.data.map((p) => p.seller_id))];
        if (sellerIds.length > 0) {
          const { data: profiles } = await supabase
            .from(TABLES.profiles)
            .select('id, full_name, email')
            .in('id', sellerIds);
          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach((p) => {
              names[p.id] = p.full_name || p.email?.split('@')[0] || 'Seller';
            });
            setSellerNames(names);
          }
        }
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    try {
      const { error } = await supabase
        .from(TABLES.orders)
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
      await logAudit('order.cancelled', 'orders', orderId);
      toast.success('Order cancelled');
      fetchData();
      loadAuditLogs();
    } catch {
      toast.error('Failed to cancel order');
    }
  }

  async function handleRefundOrder(orderId: string) {
    setRefundingId(orderId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/app_egbo_admin/refund-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Refund failed');

      toast.success('Order refunded successfully');
      fetchData();
      loadAuditLogs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      toast.error(message);
    } finally {
      setRefundingId(null);
    }
  }

  async function handleToggleProduct(productId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active';
    try {
      const { error } = await supabase
        .from(TABLES.products)
        .update({ status: newStatus })
        .eq('id', productId);
      if (error) throw error;
      const product = products.find((p) => p.id === productId);
      await logAudit('product.updated', 'products', productId, { title: product?.title, status: newStatus });
      toast.success(newStatus === 'active' ? 'Product published' : 'Product unpublished');
      fetchData();
      loadAuditLogs();
    } catch {
      toast.error('Failed to update product');
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: string) {
    try {
      const targetUser = users.find((u) => u.id === userId);
      const { error } = await supabase
        .from(TABLES.profiles)
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
      await logAudit('user.role_changed', 'profiles', userId, { email: targetUser?.email, newRole });
      toast.success('User role updated');
      fetchData();
      loadAuditLogs();
    } catch {
      toast.error('Failed to update user role');
    }
  }

  async function handleVerifySeller(sellerId: string, verify: boolean) {
    setVerifyingId(sellerId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/app_egbo_admin/verify-seller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ seller_id: sellerId, verified: verify }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Verification failed');

      toast.success(verify ? 'Seller verified for Egbo services' : 'Seller verification revoked');
      fetchData();
      loadAuditLogs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      toast.error(message);
    } finally {
      setVerifyingId(null);
    }
  }

  const sellers = users.filter((u) => u.role === 'seller');
  const pendingSellers = sellers.filter((s) => !s.verified_egbo);
  const verifiedSellers = sellers.filter((s) => s.verified_egbo);
  const egboBookings = bookings.filter((b) => b.service_type === 'egbo');

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="text-center p-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You need admin privileges to access this page.</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-8">Admin Panel</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{egboBookings.length}</p>
                <p className="text-sm text-muted-foreground">Egbo Bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-2xl font-bold">{formatPrice(orders.reduce((s, o) => s + o.total_amount, 0))}</p>
                <p className="text-sm text-muted-foreground">Revenue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="flex-wrap">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="sellers">
              <ShieldCheck className="h-4 w-4 mr-1" />
              Seller Verification
              {pendingSellers.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingSellers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="egbo-bookings">Egbo Bookings</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-6">
            {loading ? (
              <div className="space-y-4">{[...Array(3)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-6 bg-muted rounded w-1/3" /></CardContent></Card>)}</div>
            ) : orders.length === 0 ? (
              <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No orders yet.</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()} • Buyer: {order.buyer_id?.slice(0, 8) || 'N/A'}
                        </p>
                        {order.notes && <p className="text-xs text-amber-600 mt-1">{order.notes}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatPrice(order.total_amount)}</p>
                          <Badge variant={
                            order.status === 'cancelled' || order.status === 'refunded' ? 'destructive' :
                            order.status === 'paid' || order.status === 'completed' ? 'default' : 'secondary'
                          }>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1">
                          {order.status === 'paid' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={refundingId === order.id}
                              onClick={() => handleRefundOrder(order.id)}
                            >
                              {refundingId === order.id ? 'Refunding...' : 'Refund'}
                            </Button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'refunded' && order.status !== 'paid' && (
                            <Button variant="outline" size="sm" onClick={() => handleCancelOrder(order.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-6">
            {products.length === 0 ? (
              <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No products yet.</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{product.title}</h3>
                          {product.service_type === 'egbo' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">Egbo Service</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          by {sellerNames[product.seller_id] || 'Seller'} • {formatPrice(product.price)}
                          {product.duration_minutes && ` • ${product.duration_minutes} min`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleProduct(product.id, product.status)}
                        >
                          {product.status === 'active' ? 'Unpublish' : 'Publish'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            {users.length === 0 ? (
              <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No users yet.</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {users.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{u.full_name || u.email}</p>
                          {u.verified_egbo && (
                            <Badge variant="default" className="bg-green-600">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Egbo Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email} • Joined {new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                      <Select value={u.role} onValueChange={(val) => handleUpdateUserRole(u.id, val)}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buyer">Buyer</SelectItem>
                          <SelectItem value="seller">Seller</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Seller Verification Tab */}
          <TabsContent value="sellers" className="mt-6">
            <div className="space-y-6">
              {/* Pending Verification Queue */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Pending Verification ({pendingSellers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingSellers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No sellers pending verification.</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingSellers.map((seller) => (
                        <div key={seller.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{seller.full_name || seller.email}</p>
                            <p className="text-sm text-muted-foreground">{seller.email}</p>
                            {seller.bio && <p className="text-sm mt-1 text-muted-foreground">{seller.bio}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              Registered: {new Date(seller.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={verifyingId === seller.id}
                              onClick={() => handleVerifySeller(seller.id, true)}
                            >
                              {verifyingId === seller.id ? 'Verifying...' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verified Sellers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Verified Egbo Sellers ({verifiedSellers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {verifiedSellers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No verified sellers yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {verifiedSellers.map((seller) => (
                        <div key={seller.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{seller.full_name || seller.email}</p>
                              <Badge variant="default" className="bg-green-600">Verified</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{seller.email}</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={verifyingId === seller.id}
                            onClick={() => handleVerifySeller(seller.id, false)}
                          >
                            {verifyingId === seller.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Egbo Bookings Tab */}
          <TabsContent value="egbo-bookings" className="mt-6">
            {egboBookings.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No Egbo bookings yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{egboBookings.length} Egbo bookings</p>
                </div>
                {egboBookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Booking #{booking.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            Scheduled: {new Date(booking.scheduled_at).toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Duration: {booking.duration_minutes || 90} min • Price: {formatPrice(booking.price)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Client: {booking.client_id?.slice(0, 8)} • Practitioner: {booking.practitioner_id?.slice(0, 8)}
                          </p>
                          {booking.meeting_url && (
                            <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                              Meeting Link
                            </a>
                          )}
                        </div>
                        <Badge variant={
                          booking.status === 'scheduled' ? 'default' :
                          booking.status === 'completed' ? 'secondary' :
                          booking.status === 'cancelled' ? 'destructive' : 'outline'
                        }>
                          {booking.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="mt-6">
            {auditLogs.length === 0 ? (
              <Card><CardContent className="text-center py-12">
                <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No audit logs yet. Actions will be recorded here.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{auditLogs.length} log entries</p>
                  <Button variant="outline" size="sm" onClick={loadAuditLogs}>Refresh</Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Timestamp</th>
                        <th className="text-left p-3 font-medium">Action</th>
                        <th className="text-left p-3 font-medium">Resource</th>
                        <th className="text-left p-3 font-medium">Actor</th>
                        <th className="text-left p-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <Badge variant={
                              log.action.includes('deleted') || log.action.includes('cancelled') || log.action.includes('refunded') ? 'destructive' :
                              log.action.includes('created') || log.action.includes('verified') || log.action.includes('completed') ? 'default' : 'secondary'
                            }>
                              {log.action}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {log.resource}
                            {log.resource_id && <span className="text-muted-foreground ml-1">#{log.resource_id.slice(0, 8)}</span>}
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-xs">
                            {log.actor_id ? log.actor_id.slice(0, 8) : 'system'}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                            {Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}