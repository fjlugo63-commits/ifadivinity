import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured, TABLES } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Calendar,
  CreditCard,
  Clock,
  History,
  User,
  MessageSquare,
  LogOut,
  CalendarPlus,
  FileText,
  DollarSign,
  Bell,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface DashboardData {
  upcoming_consultation: {
    id: string;
    awo_name: string;
    consultation_type: string;
    scheduled_at: string;
    status: string;
  } | null;
  pending_bookings: number;
  pending_payments: number;
  recent_consultations: Array<{
    id: string;
    awo_name: string;
    consultation_type: string;
    scheduled_at: string;
    status: string;
  }>;
  ebo_status: {
    pending: number;
    in_progress: number;
    completed: number;
  };
}

// Mock data for when Supabase isn't connected
const MOCK_DASHBOARD: DashboardData = {
  upcoming_consultation: {
    id: 'mock-1',
    awo_name: 'Babalawo Adeyemi',
    consultation_type: 'Dafa (Full)',
    scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
  },
  pending_bookings: 1,
  pending_payments: 2,
  recent_consultations: [
    {
      id: 'mock-2',
      awo_name: 'Babalawo Adeyemi',
      consultation_type: 'Dafa (Full)',
      scheduled_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: 'mock-3',
      awo_name: 'Iyanifa Oluwaseun',
      consultation_type: 'Ikin Consultation',
      scheduled_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: 'mock-4',
      awo_name: 'Babalawo Adeyemi',
      consultation_type: 'Follow-up',
      scheduled_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    },
  ],
  ebo_status: { pending: 1, in_progress: 1, completed: 3 },
};

export default function ClientDashboard() {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData>(MOCK_DASHBOARD);
  const [dataLoading, setDataLoading] = useState(true);
  const [clientName, setClientName] = useState('Client');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/client/auth', { replace: true });
      return;
    }
    // Block non-client roles from accessing client portal
    if (!loading && user && userRole !== 'client' && userRole !== 'buyer' && userRole !== 'anon') {
      toast.error('Access denied. This portal is for clients only.');
      navigate('/', { replace: true });
      return;
    }
    if (user) {
      fetchDashboardData();
    }
  }, [user, userRole, loading, navigate]);

  async function fetchDashboardData() {
    setDataLoading(true);
    if (!isSupabaseConfigured) {
      setClientName('Demo Client');
      setDashboardData(MOCK_DASHBOARD);
      setDataLoading(false);
      return;
    }

    try {
      // Fetch client profile
      const { data: profile } = await supabase
        .from(TABLES.profiles)
        .select('full_name')
        .eq('id', user!.id)
        .single();

      if (profile?.full_name) {
        setClientName(profile.full_name);
      }

      // Fetch upcoming consultations
      const { data: consultations } = await supabase
        .from(TABLES.consultations)
        .select('*')
        .eq('client_id', user!.id)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5);

      // Fetch pending booking requests
      const { data: bookings } = await supabase
        .from(TABLES.booking_requests)
        .select('*')
        .eq('client_id', user!.id)
        .eq('status', 'pending');

      // Fetch recent completed consultations
      const { data: recentConsults } = await supabase
        .from(TABLES.consultations)
        .select('*')
        .eq('client_id', user!.id)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: false })
        .limit(5);

      const upcoming = consultations && consultations.length > 0 ? {
        id: consultations[0].id,
        awo_name: consultations[0].client_name || 'Practitioner',
        consultation_type: consultations[0].consultation_type || 'Consultation',
        scheduled_at: consultations[0].scheduled_at,
        status: consultations[0].status,
      } : null;

      setDashboardData({
        upcoming_consultation: upcoming,
        pending_bookings: bookings?.length || 0,
        pending_payments: 0, // Will be populated from payments table
        recent_consultations: (recentConsults || []).map((c) => ({
          id: c.id,
          awo_name: c.client_name || 'Practitioner',
          consultation_type: c.consultation_type || 'Consultation',
          scheduled_at: c.scheduled_at,
          status: c.status,
        })),
        ebo_status: { pending: 0, in_progress: 0, completed: 0 },
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setDashboardData(MOCK_DASHBOARD);
    } finally {
      setDataLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatRelativeDate(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  async function handleLogout() {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/client/auth', { replace: true });
  }

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Rubik]">Welcome, {clientName}</h1>
          <p className="text-sm text-gray-500">Your spiritual journey at a glance</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-xl relative">
          <Bell className="h-4 w-4" />
          {(dashboardData.pending_bookings > 0 || dashboardData.pending_payments > 0) && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
              {dashboardData.pending_bookings + dashboardData.pending_payments}
            </span>
          )}
        </Button>
      </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upcoming Consultation */}
          <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-white"
            onClick={() => dashboardData.upcoming_consultation && navigate(`/consultation/${dashboardData.upcoming_consultation.id}`)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                {dashboardData.upcoming_consultation && (
                  <Badge className={`text-xs rounded-full ${getStatusColor(dashboardData.upcoming_consultation.status)}`}>
                    {dashboardData.upcoming_consultation.status}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">Next Consultation</p>
              {dashboardData.upcoming_consultation ? (
                <div className="mt-1">
                  <p className="text-xs text-gray-600">{dashboardData.upcoming_consultation.awo_name}</p>
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    {formatDate(dashboardData.upcoming_consultation.scheduled_at)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">No upcoming consultations</p>
              )}
            </CardContent>
          </Card>

          {/* Pending Bookings */}
          <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{dashboardData.pending_bookings}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Pending Bookings</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting confirmation</p>
            </CardContent>
          </Card>

          {/* Pending Payments */}
          <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-red-600" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{dashboardData.pending_payments}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Pending Payments</p>
              <p className="text-xs text-gray-500 mt-1">Action required</p>
            </CardContent>
          </Card>

          {/* Ebo Status */}
          <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900">Ebo Status</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{dashboardData.ebo_status.pending} pending</span>
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{dashboardData.ebo_status.in_progress} active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="rounded-2xl border-0 shadow-md bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-[Rubik]">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 rounded-xl border-amber-200 hover:bg-amber-50 hover:border-amber-300"
                onClick={() => navigate('/client/bookings')}
              >
                <CalendarPlus className="h-5 w-5 text-amber-600" />
                <span className="text-xs font-medium">Book Consultation</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 rounded-xl border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                onClick={() => toast.info('Consultation history coming in CP-4')}
              >
                <History className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-medium">View History</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 rounded-xl border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={() => navigate('/client/payments')}
              >
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="text-xs font-medium">View Payments</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 rounded-xl border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                onClick={() => navigate('/client/profile')}
              >
                <User className="h-5 w-5 text-purple-600" />
                <span className="text-xs font-medium">Update Profile</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                onClick={() => navigate('/client/messages')}
              >
                <MessageSquare className="h-5 w-5 text-gray-600" />
                <span className="text-xs font-medium">Messages</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity + Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Consultations */}
          <Card className="rounded-2xl border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Recent Consultations
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-amber-600 hover:text-amber-700">
                  View All <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.recent_consultations.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No consultations yet</p>
                  <p className="text-xs text-gray-400 mt-1">Book your first consultation to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData.recent_consultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/consultation/${consultation.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{consultation.awo_name}</p>
                          <p className="text-xs text-gray-500">{consultation.consultation_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs rounded-full ${getStatusColor(consultation.status)}`}>
                          {consultation.status}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">{formatRelativeDate(consultation.scheduled_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming & Booking Requests */}
          <Card className="rounded-2xl border-0 shadow-md bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Upcoming & Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upcoming Consultation Detail */}
              {dashboardData.upcoming_consultation ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">Next Session</p>
                    <Badge className="text-xs rounded-full bg-green-100 text-green-700">
                      {dashboardData.upcoming_consultation.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700">{dashboardData.upcoming_consultation.awo_name}</p>
                  <p className="text-xs text-gray-500 mt-1">{dashboardData.upcoming_consultation.consultation_type}</p>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-700">
                      {formatDate(dashboardData.upcoming_consultation.scheduled_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gray-50 text-center">
                  <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No upcoming consultations</p>
                  <Button
                    size="sm"
                    className="mt-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => toast.info('Booking flow coming in CP-2')}
                  >
                    Book Now
                  </Button>
                </div>
              )}

              {/* Pending Booking Requests */}
              {dashboardData.pending_bookings > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-gray-900">Pending Requests</p>
                  </div>
                  <p className="text-xs text-gray-600">
                    You have {dashboardData.pending_bookings} booking request{dashboardData.pending_bookings > 1 ? 's' : ''} awaiting practitioner confirmation.
                  </p>
                </div>
              )}

              {/* Ebo Summary */}
              {(dashboardData.ebo_status.pending > 0 || dashboardData.ebo_status.in_progress > 0) && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-semibold text-gray-900">Ebo Progress</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    {dashboardData.ebo_status.pending > 0 && (
                      <span className="text-amber-700">{dashboardData.ebo_status.pending} pending</span>
                    )}
                    {dashboardData.ebo_status.in_progress > 0 && (
                      <span className="text-blue-700">{dashboardData.ebo_status.in_progress} in progress</span>
                    )}
                    {dashboardData.ebo_status.completed > 0 && (
                      <span className="text-green-700">{dashboardData.ebo_status.completed} completed</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}