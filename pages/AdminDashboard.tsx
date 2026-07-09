import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Users, Calendar, CreditCard, ShoppingBag, Clock } from 'lucide-react';
import { supabase, TABLES } from '@/lib/supabase';

interface DashboardMetrics {
  totalAwos: number;
  totalClients: number;
  consultations30d: number;
  payments30d: number;
  botanicaOrders30d: number;
}

interface ActivityItem {
  id: string;
  type: 'consultation' | 'payment' | 'order' | 'user';
  description: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalAwos: 0,
    totalClients: 0,
    consultations30d: 0,
    payments30d: 0,
    botanicaOrders30d: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      const [awosRes, clientsRes, consultationsRes, paymentsRes, ordersRes] = await Promise.all([
        supabase.from(TABLES.profiles).select('id', { count: 'exact', head: true }).eq('role', 'awo'),
        supabase.from(TABLES.clients).select('id', { count: 'exact', head: true }),
        supabase.from(TABLES.consultations).select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgoStr),
        supabase.from(TABLES.orders).select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgoStr).eq('status', 'paid'),
        supabase.from(TABLES.orders).select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgoStr),
      ]);

      setMetrics({
        totalAwos: awosRes.count || 0,
        totalClients: clientsRes.count || 0,
        consultations30d: consultationsRes.count || 0,
        payments30d: paymentsRes.count || 0,
        botanicaOrders30d: ordersRes.count || 0,
      });

      // Fetch recent activity
      const [recentConsultations, recentOrders, recentUsers] = await Promise.all([
        supabase.from(TABLES.consultations).select('id, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from(TABLES.orders).select('id, status, total_amount, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from(TABLES.profiles).select('id, full_name, email, role, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const activityItems: ActivityItem[] = [];

      recentConsultations.data?.forEach((c) => {
        activityItems.push({
          id: `c-${c.id}`,
          type: 'consultation',
          description: `New consultation (${c.status || 'active'})`,
          timestamp: c.created_at,
        });
      });

      recentOrders.data?.forEach((o) => {
        activityItems.push({
          id: `o-${o.id}`,
          type: 'order',
          description: `Order ${o.status} - $${(o.total_amount / 100).toFixed(2)}`,
          timestamp: o.created_at,
        });
      });

      recentUsers.data?.forEach((u) => {
        activityItems.push({
          id: `u-${u.id}`,
          type: 'user',
          description: `New ${u.role || 'user'}: ${u.full_name || u.email?.split('@')[0] || 'Unknown'}`,
          timestamp: u.created_at,
        });
      });

      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(activityItems.slice(0, 15));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const metricCards = [
    { label: 'Total Awos', value: metrics.totalAwos, icon: UserCheck, color: 'text-purple-600 bg-purple-100' },
    { label: 'Total Clients', value: metrics.totalClients, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Consultations (30d)', value: metrics.consultations30d, icon: Calendar, color: 'text-green-600 bg-green-100' },
    { label: 'Payments (30d)', value: metrics.payments30d, icon: CreditCard, color: 'text-amber-600 bg-amber-100' },
    { label: 'Botanica Orders (30d)', value: metrics.botanicaOrders30d, icon: ShoppingBag, color: 'text-rose-600 bg-rose-100' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        item.type === 'consultation'
                          ? 'border-green-300 text-green-700'
                          : item.type === 'payment'
                          ? 'border-amber-300 text-amber-700'
                          : item.type === 'order'
                          ? 'border-rose-300 text-rose-700'
                          : 'border-blue-300 text-blue-700'
                      }
                    >
                      {item.type}
                    </Badge>
                    <span className="text-sm text-gray-700">{item.description}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}