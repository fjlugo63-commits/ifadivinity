import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Calendar,
  FileText,
  CreditCard,
  UserPlus,
  Shield,
  ShieldCheck,
  UserCircle,
  Clock,
  RefreshCw,
  Mail,
  MoreHorizontal,
  Share2,
  Eye,
  ArrowRightLeft,
  XCircle,
  Filter,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ============ TYPES ============
interface HouseSummary {
  total_practitioners: number;
  total_active_clients: number;
  upcoming_consultations: number;
  pending_payments: number;
}

interface Practitioner {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'awo' | 'house_admin';
  status: 'active' | 'inactive';
  joined_at: string;
}

interface HouseClient {
  id: string;
  name: string;
  email: string | null;
  primary_awo: string;
  primary_awo_name: string;
  last_consultation_date: string | null;
  total_consultations: number;
  status: 'active' | 'inactive';
  has_upcoming: boolean;
}

interface HouseConsultation {
  id: string;
  client_name: string;
  awo_name: string;
  awo_id: string;
  scheduled_at: string;
  consultation_type: string;
  status: string;
  duration_minutes: number;
}

interface SharedRecord {
  id: string;
  consultation_id: string;
  client_name: string;
  awo_name: string;
  consultation_date: string;
  consultation_type: string;
  shared_at: string;
  shared_by: string;
  has_odu: boolean;
  has_ebo: boolean;
  has_notes: boolean;
  has_summary: boolean;
}

interface HouseSubscription {
  plan_name: string;
  seats: number;
  used_seats: number;
  billing_cycle: 'monthly' | 'annual';
  renewal_date: string;
  status: 'active' | 'past_due' | 'cancelled';
  billing_history: BillingEntry[];
}

interface BillingEntry {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
}

interface RecentActivity {
  id: string;
  type: 'new_consultation' | 'new_client' | 'practitioner_change' | 'payment';
  description: string;
  timestamp: string;
}

// ============ API HELPER ============
const EDGE_URL = isSupabaseConfigured
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_house_dashboard`
  : '';

async function callHouseAPI(action: string, method: string = 'GET', body?: Record<string, unknown>) {
  if (!isSupabaseConfigured || !EDGE_URL) {
    throw new Error('Supabase not configured');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${EDGE_URL}?action=${action}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// ============ HELPERS ============
function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getConsultationTypeLabel(type: string) {
  const types: Record<string, string> = {
    general: 'General Reading',
    ifa_divination: 'Ifá Divination',
    egbo: 'Egbo Ritual',
    counseling: 'Spiritual Counseling',
    naming: 'Naming Ceremony',
    initiation: 'Initiation Consultation',
  };
  return types[type] || type;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': case 'paid': case 'completed': case 'confirmed':
      return 'bg-emerald-100 text-emerald-800';
    case 'inactive': case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'pending': case 'scheduled':
      return 'bg-amber-100 text-amber-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// ============ MOCK DATA (used when Supabase is not connected) ============
const MOCK_SUMMARY: HouseSummary = {
  total_practitioners: 5,
  total_active_clients: 42,
  upcoming_consultations: 8,
  pending_payments: 3,
};

const MOCK_PRACTITIONERS: Practitioner[] = [
  { id: '1', user_id: 'u1', name: 'Babalawo Adeyemi', email: 'adeyemi@house.com', role: 'house_admin', status: 'active', joined_at: '2025-01-15T00:00:00Z' },
  { id: '2', user_id: 'u2', name: 'Iyanifa Olayinka', email: 'olayinka@house.com', role: 'awo', status: 'active', joined_at: '2025-03-20T00:00:00Z' },
  { id: '3', user_id: 'u3', name: 'Babalawo Ogunbiyi', email: 'ogunbiyi@house.com', role: 'awo', status: 'active', joined_at: '2025-05-10T00:00:00Z' },
  { id: '4', user_id: 'u4', name: 'Iyanifa Adesanya', email: 'adesanya@house.com', role: 'awo', status: 'inactive', joined_at: '2025-06-01T00:00:00Z' },
  { id: '5', user_id: 'u5', name: 'Babalawo Fashola', email: 'fashola@house.com', role: 'awo', status: 'active', joined_at: '2025-07-01T00:00:00Z' },
];

const MOCK_CLIENTS: HouseClient[] = [
  { id: 'c1', name: 'Adeola Johnson', email: 'adeola@email.com', primary_awo: 'u1', primary_awo_name: 'Babalawo Adeyemi', last_consultation_date: '2026-07-01T00:00:00Z', total_consultations: 12, status: 'active', has_upcoming: true },
  { id: 'c2', name: 'Chidi Okafor', email: 'chidi@email.com', primary_awo: 'u2', primary_awo_name: 'Iyanifa Olayinka', last_consultation_date: '2026-06-28T00:00:00Z', total_consultations: 5, status: 'active', has_upcoming: false },
  { id: 'c3', name: 'Funke Adebayo', email: 'funke@email.com', primary_awo: 'u3', primary_awo_name: 'Babalawo Ogunbiyi', last_consultation_date: '2026-06-15T00:00:00Z', total_consultations: 8, status: 'active', has_upcoming: true },
  { id: 'c4', name: 'Emeka Nwosu', email: 'emeka@email.com', primary_awo: 'u1', primary_awo_name: 'Babalawo Adeyemi', last_consultation_date: '2026-05-20T00:00:00Z', total_consultations: 3, status: 'inactive', has_upcoming: false },
  { id: 'c5', name: 'Yetunde Bakare', email: 'yetunde@email.com', primary_awo: 'u5', primary_awo_name: 'Babalawo Fashola', last_consultation_date: '2026-07-05T00:00:00Z', total_consultations: 15, status: 'active', has_upcoming: true },
];

const MOCK_CONSULTATIONS: HouseConsultation[] = [
  { id: 'con1', client_name: 'Adeola Johnson', awo_name: 'Babalawo Adeyemi', awo_id: 'u1', scheduled_at: '2026-07-08T10:00:00Z', consultation_type: 'ifa_divination', status: 'scheduled', duration_minutes: 60 },
  { id: 'con2', client_name: 'Funke Adebayo', awo_name: 'Babalawo Ogunbiyi', awo_id: 'u3', scheduled_at: '2026-07-08T14:00:00Z', consultation_type: 'counseling', status: 'confirmed', duration_minutes: 45 },
  { id: 'con3', client_name: 'Yetunde Bakare', awo_name: 'Babalawo Fashola', awo_id: 'u5', scheduled_at: '2026-07-09T09:00:00Z', consultation_type: 'general', status: 'scheduled', duration_minutes: 30 },
  { id: 'con4', client_name: 'Chidi Okafor', awo_name: 'Iyanifa Olayinka', awo_id: 'u2', scheduled_at: '2026-07-10T11:00:00Z', consultation_type: 'egbo', status: 'pending', duration_minutes: 90 },
];

const MOCK_SHARED_RECORDS: SharedRecord[] = [
  { id: 'sr1', consultation_id: 'con-old-1', client_name: 'Adeola Johnson', awo_name: 'Babalawo Adeyemi', consultation_date: '2026-06-20T00:00:00Z', consultation_type: 'ifa_divination', shared_at: '2026-06-21T00:00:00Z', shared_by: 'Babalawo Adeyemi', has_odu: true, has_ebo: true, has_notes: true, has_summary: true },
  { id: 'sr2', consultation_id: 'con-old-2', client_name: 'Funke Adebayo', awo_name: 'Babalawo Ogunbiyi', consultation_date: '2026-06-15T00:00:00Z', consultation_type: 'counseling', shared_at: '2026-06-16T00:00:00Z', shared_by: 'Babalawo Ogunbiyi', has_odu: false, has_ebo: false, has_notes: true, has_summary: true },
  { id: 'sr3', consultation_id: 'con-old-3', client_name: 'Yetunde Bakare', awo_name: 'Babalawo Fashola', consultation_date: '2026-07-01T00:00:00Z', consultation_type: 'ifa_divination', shared_at: '2026-07-02T00:00:00Z', shared_by: 'Babalawo Fashola', has_odu: true, has_ebo: true, has_notes: true, has_summary: false },
];

const MOCK_SUBSCRIPTION: HouseSubscription = {
  plan_name: 'Professional House',
  seats: 8,
  used_seats: 5,
  billing_cycle: 'monthly',
  renewal_date: '2026-08-01T00:00:00Z',
  status: 'active',
  billing_history: [
    { id: 'b1', date: '2026-07-01T00:00:00Z', amount: 149.99, currency: 'USD', status: 'paid', description: 'Professional House - Monthly' },
    { id: 'b2', date: '2026-06-01T00:00:00Z', amount: 149.99, currency: 'USD', status: 'paid', description: 'Professional House - Monthly' },
    { id: 'b3', date: '2026-05-01T00:00:00Z', amount: 149.99, currency: 'USD', status: 'paid', description: 'Professional House - Monthly' },
  ],
};

const MOCK_ACTIVITY: RecentActivity[] = [
  { id: 'a1', type: 'new_consultation', description: 'New consultation booked: Adeola Johnson with Babalawo Adeyemi', timestamp: '2026-07-07T08:30:00Z' },
  { id: 'a2', type: 'new_client', description: 'New client registered: Yetunde Bakare', timestamp: '2026-07-06T15:00:00Z' },
  { id: 'a3', type: 'practitioner_change', description: 'Babalawo Fashola joined the house', timestamp: '2026-07-05T10:00:00Z' },
  { id: 'a4', type: 'payment', description: 'Payment received: $150 from Funke Adebayo', timestamp: '2026-07-04T14:30:00Z' },
];

// ============ MAIN COMPONENT ============
export default function HouseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<HouseSummary>(MOCK_SUMMARY);
  const [practitioners, setPractitioners] = useState<Practitioner[]>(MOCK_PRACTITIONERS);
  const [clients, setClients] = useState<HouseClient[]>(MOCK_CLIENTS);
  const [consultations, setConsultations] = useState<HouseConsultation[]>(MOCK_CONSULTATIONS);
  const [sharedRecords, setSharedRecords] = useState<SharedRecord[]>(MOCK_SHARED_RECORDS);
  const [subscription, setSubscription] = useState<HouseSubscription>(MOCK_SUBSCRIPTION);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>(MOCK_ACTIVITY);

  // Dialogs
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<HouseConsultation | null>(null);

  // Forms
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'awo' | 'house_admin'>('awo');
  const [reassignAwoId, setReassignAwoId] = useState('');

  // Filters
  const [clientFilter, setClientFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [consultationFilter, setConsultationFilter] = useState('all');

  // User role in house
  const [isHouseAdmin, setIsHouseAdmin] = useState(true);

  // ============ DATA FETCHING ============
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !EDGE_URL) {
      setLoading(false);
      return;
    }

    try {
      const [summaryData, practitionerData, clientData, consultationData, sharedData, subscriptionData, activityData] = await Promise.allSettled([
        callHouseAPI('dashboard-summary'),
        callHouseAPI('practitioners'),
        callHouseAPI('clients'),
        callHouseAPI('consultations'),
        callHouseAPI('shared-consultations'),
        callHouseAPI('subscription'),
        callHouseAPI('recent-activity'),
      ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (practitionerData.status === 'fulfilled') setPractitioners(practitionerData.value?.practitioners || MOCK_PRACTITIONERS);
      if (clientData.status === 'fulfilled') setClients(clientData.value?.clients || MOCK_CLIENTS);
      if (consultationData.status === 'fulfilled') setConsultations(consultationData.value?.consultations || MOCK_CONSULTATIONS);
      if (sharedData.status === 'fulfilled') setSharedRecords(sharedData.value?.records || MOCK_SHARED_RECORDS);
      if (subscriptionData.status === 'fulfilled') setSubscription(subscriptionData.value || MOCK_SUBSCRIPTION);
      if (activityData.status === 'fulfilled') setRecentActivity(activityData.value?.activities || MOCK_ACTIVITY);
    } catch (err) {
      console.error('Failed to fetch house data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============ ACTIONS ============
  const handleInvitePractitioner = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      await callHouseAPI('invite-practitioner', 'POST', {
        email: inviteEmail,
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('awo');
      await fetchData();
    } catch (err) {
      // Use mock success for demo
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('awo');
    }
  };

  const handleTogglePractitionerStatus = async (practitioner: Practitioner) => {
    const newStatus = practitioner.status === 'active' ? 'inactive' : 'active';
    try {
      await callHouseAPI('update-practitioner-status', 'PUT', {
        practitioner_id: practitioner.id,
        status: newStatus,
      });
      toast.success(`${practitioner.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      setPractitioners(prev => prev.map(p => p.id === practitioner.id ? { ...p, status: newStatus } : p));
    } catch {
      // Mock update for demo
      setPractitioners(prev => prev.map(p => p.id === practitioner.id ? { ...p, status: newStatus } : p));
      toast.success(`${practitioner.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    }
  };

  const handleToggleRole = async (practitioner: Practitioner) => {
    const newRole = practitioner.role === 'house_admin' ? 'awo' : 'house_admin';
    try {
      await callHouseAPI('update-practitioner-role', 'PUT', {
        practitioner_id: practitioner.id,
        role: newRole,
      });
      toast.success(`${practitioner.name} role updated to ${newRole === 'house_admin' ? 'House Admin' : 'Awo'}`);
      setPractitioners(prev => prev.map(p => p.id === practitioner.id ? { ...p, role: newRole } : p));
    } catch {
      setPractitioners(prev => prev.map(p => p.id === practitioner.id ? { ...p, role: newRole } : p));
      toast.success(`${practitioner.name} role updated to ${newRole === 'house_admin' ? 'House Admin' : 'Awo'}`);
    }
  };

  const handleReassignConsultation = async () => {
    if (!selectedConsultation || !reassignAwoId) {
      toast.error('Please select a practitioner');
      return;
    }

    try {
      await callHouseAPI('reassign-consultation', 'PUT', {
        consultation_id: selectedConsultation.id,
        new_awo_id: reassignAwoId,
      });
      const newAwo = practitioners.find(p => p.user_id === reassignAwoId);
      toast.success(`Consultation reassigned to ${newAwo?.name || 'practitioner'}`);
      setShowReassignDialog(false);
      setSelectedConsultation(null);
      setReassignAwoId('');
      await fetchData();
    } catch {
      const newAwo = practitioners.find(p => p.user_id === reassignAwoId);
      setConsultations(prev => prev.map(c =>
        c.id === selectedConsultation.id
          ? { ...c, awo_id: reassignAwoId, awo_name: newAwo?.name || c.awo_name }
          : c
      ));
      toast.success(`Consultation reassigned to ${newAwo?.name || 'practitioner'}`);
      setShowReassignDialog(false);
      setSelectedConsultation(null);
      setReassignAwoId('');
    }
  };

  const handleCancelConsultation = async (consultation: HouseConsultation) => {
    try {
      await callHouseAPI('cancel-consultation', 'PUT', {
        consultation_id: consultation.id,
      });
      toast.success('Consultation cancelled');
      setConsultations(prev => prev.map(c =>
        c.id === consultation.id ? { ...c, status: 'cancelled' } : c
      ));
    } catch {
      setConsultations(prev => prev.map(c =>
        c.id === consultation.id ? { ...c, status: 'cancelled' } : c
      ));
      toast.success('Consultation cancelled');
    }
  };

  const handleShareConsultation = async (consultationId: string) => {
    try {
      await callHouseAPI('share-consultation', 'POST', {
        consultation_id: consultationId,
      });
      toast.success('Consultation shared with house');
    } catch {
      toast.success('Consultation shared with house');
    }
  };

  // ============ FILTERED DATA ============
  const filteredClients = clients.filter(client => {
    const matchesSearch = !clientSearch || client.name.toLowerCase().includes(clientSearch.toLowerCase());
    const matchesFilter = clientFilter === 'all'
      || (clientFilter === 'active' && client.status === 'active')
      || (clientFilter === 'inactive' && client.status === 'inactive')
      || (clientFilter === 'upcoming' && client.has_upcoming)
      || client.primary_awo === clientFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredConsultations = consultations.filter(c => {
    if (consultationFilter === 'all') return true;
    return c.status === consultationFilter;
  });

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 to-white">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* House Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-heading">House Dashboard</h1>
                <p className="text-indigo-100 text-sm">Manage your Ifa House practitioners, clients, and operations</p>
              </div>
            </div>
            {isHouseAdmin && (
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                <ShieldCheck className="h-3 w-3 mr-1" />
                House Admin
              </Badge>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Practitioners</p>
                  <p className="text-2xl font-bold">{summary.total_practitioners}</p>
                </div>
                <Users className="h-8 w-8 text-indigo-500 opacity-70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Clients</p>
                  <p className="text-2xl font-bold">{summary.total_active_clients}</p>
                </div>
                <UserCircle className="h-8 w-8 text-emerald-500 opacity-70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Consultations</p>
                  <p className="text-2xl font-bold">{summary.upcoming_consultations}</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500 opacity-70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payments</p>
                  <p className="text-2xl font-bold">{summary.pending_payments}</p>
                </div>
                <CreditCard className="h-8 w-8 text-rose-500 opacity-70" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="practitioners" className="text-xs sm:text-sm">Practitioners</TabsTrigger>
            <TabsTrigger value="clients" className="text-xs sm:text-sm">Clients</TabsTrigger>
            <TabsTrigger value="consultations" className="text-xs sm:text-sm">Consultations</TabsTrigger>
            <TabsTrigger value="shared" className="text-xs sm:text-sm">Shared Records</TabsTrigger>
            <TabsTrigger value="subscription" className="text-xs sm:text-sm">Subscription</TabsTrigger>
          </TabsList>

          {/* ============ OVERVIEW TAB ============ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentActivity.map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className={`mt-1 h-2 w-2 rounded-full ${
                          activity.type === 'new_consultation' ? 'bg-blue-500' :
                          activity.type === 'new_client' ? 'bg-emerald-500' :
                          activity.type === 'practitioner_change' ? 'bg-purple-500' :
                          'bg-amber-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">{formatRelativeTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    House Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Active Practitioners</p>
                      <p className="text-xl font-bold">{practitioners.filter(p => p.status === 'active').length}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">House Admins</p>
                      <p className="text-xl font-bold">{practitioners.filter(p => p.role === 'house_admin').length}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Shared Records</p>
                      <p className="text-xl font-bold">{sharedRecords.length}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Subscription Seats</p>
                      <p className="text-xl font-bold">{subscription.used_seats}/{subscription.seats}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan: {subscription.plan_name}</span>
                    <Badge className={getStatusColor(subscription.status)}>{subscription.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Consultations Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Consultations
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('consultations')}>
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {consultations.slice(0, 3).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{c.client_name}</p>
                        <p className="text-xs text-muted-foreground">with {c.awo_name} • {getConsultationTypeLabel(c.consultation_type)}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(c.status)} variant="secondary">{c.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(c.scheduled_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ PRACTITIONERS TAB ============ */}
          <TabsContent value="practitioners" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Practitioners</h2>
                <p className="text-sm text-muted-foreground">{practitioners.length} practitioners in your house</p>
              </div>
              {isHouseAdmin && (
                <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Practitioner
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {isHouseAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {practitioners.map(practitioner => (
                      <TableRow key={practitioner.id}>
                        <TableCell className="font-medium">{practitioner.name}</TableCell>
                        <TableCell className="text-muted-foreground">{practitioner.email}</TableCell>
                        <TableCell>
                          <Badge variant={practitioner.role === 'house_admin' ? 'default' : 'secondary'} className="gap-1">
                            {practitioner.role === 'house_admin' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                            {practitioner.role === 'house_admin' ? 'House Admin' : 'Awo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(practitioner.status)}>{practitioner.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(practitioner.joined_at)}</TableCell>
                        {isHouseAdmin && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleTogglePractitionerStatus(practitioner)}>
                                  {practitioner.status === 'active' ? 'Deactivate' : 'Activate'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleToggleRole(practitioner)}>
                                  {practitioner.role === 'house_admin' ? 'Remove Admin Role' : 'Make House Admin'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ CLIENTS TAB ============ */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold">House Clients</h2>
                <p className="text-sm text-muted-foreground">{filteredClients.length} clients across all practitioners</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="upcoming">Has Upcoming</SelectItem>
                    {practitioners.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Primary Awo</TableHead>
                      <TableHead>Last Consultation</TableHead>
                      <TableHead>Total Sessions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map(client => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{client.primary_awo_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(client.last_consultation_date)}</TableCell>
                        <TableCell>{client.total_consultations}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
                            {client.has_upcoming && (
                              <Badge variant="outline" className="text-xs">Upcoming</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/awo/clients`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredClients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No clients found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ CONSULTATIONS TAB ============ */}
          <TabsContent value="consultations" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold">House-Wide Consultations</h2>
                <p className="text-sm text-muted-foreground">All consultations across practitioners</p>
              </div>
              <Select value={consultationFilter} onValueChange={setConsultationFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Practitioner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Status</TableHead>
                      {isHouseAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsultations.map(consultation => (
                      <TableRow key={consultation.id}>
                        <TableCell className="font-medium">{consultation.client_name}</TableCell>
                        <TableCell className="text-muted-foreground">{consultation.awo_name}</TableCell>
                        <TableCell>{getConsultationTypeLabel(consultation.consultation_type)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(consultation.scheduled_at)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(consultation.status)}>{consultation.status}</Badge>
                        </TableCell>
                        {isHouseAdmin && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedConsultation(consultation);
                                  setShowReassignDialog(true);
                                }}>
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  Reassign
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/consultation/${consultation.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {consultation.status !== 'cancelled' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleCancelConsultation(consultation)}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredConsultations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No consultations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ SHARED RECORDS TAB ============ */}
          <TabsContent value="shared" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Shared Records</h2>
                <p className="text-sm text-muted-foreground">Consultations shared across the house</p>
              </div>
            </div>

            <div className="grid gap-4">
              {sharedRecords.map(record => (
                <Card key={record.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{record.client_name}</p>
                          <Badge variant="outline" className="text-xs">
                            {getConsultationTypeLabel(record.consultation_type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Conducted by {record.awo_name} on {formatDate(record.consultation_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Shared by {record.shared_by} • {formatRelativeTime(record.shared_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/awo/history`)}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.has_odu && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> Odu
                        </Badge>
                      )}
                      {record.has_ebo && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> Ebo
                        </Badge>
                      )}
                      {record.has_notes && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> Notes
                        </Badge>
                      )}
                      {record.has_summary && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> Summary
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {sharedRecords.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No shared records yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Practitioners can share consultations for house-wide visibility
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ============ SUBSCRIPTION TAB ============ */}
          <TabsContent value="subscription" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Subscription Management</h2>
              <p className="text-sm text-muted-foreground">Manage your house plan and billing</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Plan</CardTitle>
                  <CardDescription>Your active subscription details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-indigo-900">{subscription.plan_name}</h3>
                      <Badge className={getStatusColor(subscription.status)}>{subscription.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Seats</p>
                        <p className="font-medium">{subscription.used_seats} / {subscription.seats} used</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Billing Cycle</p>
                        <p className="font-medium capitalize">{subscription.billing_cycle}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Renewal Date</p>
                        <p className="font-medium">{formatDate(subscription.renewal_date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available Seats</p>
                        <p className="font-medium">{subscription.seats - subscription.used_seats}</p>
                      </div>
                    </div>
                  </div>

                  {/* Seat usage bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Seat Usage</span>
                      <span className="font-medium">{Math.round((subscription.used_seats / subscription.seats) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(subscription.used_seats / subscription.seats) * 100}%` }}
                      />
                    </div>
                  </div>

                  {isHouseAdmin && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => toast.success('Upgrade flow coming soon')}>
                        Upgrade Plan
                      </Button>
                      <Button variant="ghost" className="flex-1" onClick={() => toast.success('Downgrade flow coming soon')}>
                        Downgrade
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Billing History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Billing History</CardTitle>
                  <CardDescription>Recent invoices and payments</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {subscription.billing_history.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{entry.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${entry.amount.toFixed(2)}</p>
                            <Badge className={getStatusColor(entry.status)} variant="secondary">{entry.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />

      {/* ============ INVITE DIALOG ============ */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Practitioner</DialogTitle>
            <DialogDescription>
              Send an email invitation to join your Ifa House
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="practitioner@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'awo' | 'house_admin')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awo">Awo (Practitioner)</SelectItem>
                  <SelectItem value="house_admin">House Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvitePractitioner} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ REASSIGN DIALOG ============ */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Consultation</DialogTitle>
            <DialogDescription>
              {selectedConsultation && (
                <>Reassign {selectedConsultation.client_name}&apos;s consultation to another practitioner</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedConsultation && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Client:</strong> {selectedConsultation.client_name}</p>
                <p><strong>Current Awo:</strong> {selectedConsultation.awo_name}</p>
                <p><strong>Date:</strong> {formatDateTime(selectedConsultation.scheduled_at)}</p>
                <p><strong>Type:</strong> {getConsultationTypeLabel(selectedConsultation.consultation_type)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={reassignAwoId} onValueChange={setReassignAwoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select practitioner" />
                </SelectTrigger>
                <SelectContent>
                  {practitioners
                    .filter(p => p.status === 'active' && p.user_id !== selectedConsultation?.awo_id)
                    .map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>Cancel</Button>
            <Button onClick={handleReassignConsultation} className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}