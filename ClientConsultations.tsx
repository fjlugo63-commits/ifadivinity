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
  History,
  Calendar,
  User,
  Clock,
  ChevronRight,
  FileText,
  CreditCard,
  MessageSquare,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Consultation {
  id: string;
  awo_name: string;
  consultation_type: string;
  scheduled_at: string;
  status: string;
  notes?: string;
  payment_status?: string;
  booking_ref?: string;
}

const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: 'c1',
    awo_name: 'Baba Ifasegun',
    consultation_type: 'Dafa (Full Reading)',
    scheduled_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    notes: 'Odu Ifa: Ogbe Meji. Guidance provided on career path.',
    payment_status: 'paid',
    booking_ref: 'BK-2024-001',
  },
  {
    id: 'c2',
    awo_name: 'Iya Osun',
    consultation_type: 'Ebo Consultation',
    scheduled_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    notes: 'Ebo prescribed for health and prosperity.',
    payment_status: 'paid',
    booking_ref: 'BK-2024-002',
  },
  {
    id: 'c3',
    awo_name: 'Baba Ifasegun',
    consultation_type: 'Follow-up',
    scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    payment_status: 'pending',
    booking_ref: 'BK-2024-003',
  },
  {
    id: 'c4',
    awo_name: 'Baba Awo Tunde',
    consultation_type: 'Dafa (Full Reading)',
    scheduled_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    notes: 'Odu Ifa: Irosun Meji. Guidance on family matters.',
    payment_status: 'paid',
    booking_ref: 'BK-2024-004',
  },
];

export default function ClientConsultations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    loadConsultations();
  }, [user]);

  const loadConsultations = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !user) {
        setConsultations(MOCK_CONSULTATIONS);
        setLoading(false);
        return;
      }

      const { data: clientData } = await supabase
        .from(TABLES.clients)
        .select('id')
        .eq('email', user.email)
        .eq('status', 'active')
        .single();

      if (clientData) {
        const { data: bookings } = await supabase
          .from(TABLES.bookings)
          .select('*')
          .eq('client_id', clientData.id)
          .order('scheduled_at', { ascending: false });

        if (bookings && bookings.length > 0) {
          setConsultations(bookings.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            awo_name: (b.awo_name as string) || 'Awo',
            consultation_type: (b.consultation_type as string) || 'Consultation',
            scheduled_at: b.scheduled_at as string,
            status: b.status as string,
            notes: b.notes as string | undefined,
            payment_status: b.payment_status as string | undefined,
            booking_ref: b.booking_ref as string | undefined,
          })));
        } else {
          setConsultations(MOCK_CONSULTATIONS);
        }
      } else {
        setConsultations(MOCK_CONSULTATIONS);
      }
    } catch (err) {
      console.error('Error loading consultations:', err);
      setConsultations(MOCK_CONSULTATIONS);
      toast.error('Failed to load consultations');
    } finally {
      setLoading(false);
    }
  };

  const filteredConsultations = consultations.filter((c) => {
    const matchesSearch = searchQuery === '' ||
      c.awo_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.consultation_type.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'upcoming') {
      return matchesSearch && (c.status === 'scheduled' || c.status === 'confirmed');
    }
    if (filter === 'completed') {
      return matchesSearch && c.status === 'completed';
    }
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Completed</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">Scheduled</Badge>;
      case 'confirmed':
        return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">Confirmed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">Cancelled</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-xs">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Rubik]">Consultation History</h1>
          <p className="text-sm text-gray-500 mt-1">View all your past and upcoming consultations</p>
        </div>
        <Button
          onClick={() => navigate('/client/bookings')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Book New
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by Awo or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'upcoming', 'completed'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'bg-indigo-600 text-white' : ''}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Consultations List */}
      {filteredConsultations.length === 0 ? (
        <Card className="border-amber-100">
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No consultations found</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/client/bookings')}
            >
              Book Your First Consultation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredConsultations.map((consultation) => (
            <Card
              key={consultation.id}
              className="border-amber-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/client/consultations/${consultation.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {consultation.consultation_type}
                      </h3>
                      {getStatusBadge(consultation.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {consultation.awo_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(consultation.scheduled_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(consultation.scheduled_at)}
                      </span>
                    </div>
                    {consultation.booking_ref && (
                      <p className="text-xs text-gray-400 mt-1">Ref: {consultation.booking_ref}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {consultation.payment_status === 'pending' && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Payment Due
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <Card className="border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{consultations.filter(c => c.status === 'completed').length}</p>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{consultations.filter(c => c.status === 'scheduled' || c.status === 'confirmed').length}</p>
            <p className="text-xs text-gray-500 mt-1">Upcoming</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{consultations.filter(c => c.payment_status === 'pending').length}</p>
            <p className="text-xs text-gray-500 mt-1">Payments Due</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}