import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured, TABLES } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Check,
  X,
  RefreshCw,
  ArrowLeft,
  CalendarPlus,
  User,
  Globe,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Bell,
} from 'lucide-react';

// ============ TYPES ============
interface AvailableSlot {
  date: string;
  start_time: string;
  end_time: string;
  awo_id: string;
  awo_name: string;
}

interface BookingRequest {
  id: string;
  awo_id: string;
  awo_name: string;
  requested_at: string;
  duration_minutes: number;
  service_type: string;
  status: 'pending' | 'accepted' | 'declined' | 'proposed_new_time';
  proposed_time: string | null;
  client_message: string | null;
  awo_response: string | null;
  consultation_id: string | null;
  payment_status?: string;
  created_at: string;
}

// ============ MOCK DATA ============
const MOCK_PRACTITIONERS = [
  { id: 'awo-1', name: 'Babalawo Adeyemi', service_types: ['Dafa (Full)', 'Ikin Consultation', 'Follow-up'] },
  { id: 'awo-2', name: 'Iyanifa Oluwaseun', service_types: ['Dafa (Full)', 'Ose Ifa', 'Follow-up'] },
];

function generateMockSlots(): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const today = new Date();
  for (let d = 1; d <= 14; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    if (date.getDay() === 0) continue; // Skip Sundays
    const dateStr = date.toISOString().split('T')[0];
    const practitioner = MOCK_PRACTITIONERS[d % 2];
    // Morning slots
    slots.push({ date: dateStr, start_time: '09:00', end_time: '10:00', awo_id: practitioner.id, awo_name: practitioner.name });
    slots.push({ date: dateStr, start_time: '10:30', end_time: '11:30', awo_id: practitioner.id, awo_name: practitioner.name });
    // Afternoon slots
    if (d % 3 !== 0) {
      slots.push({ date: dateStr, start_time: '14:00', end_time: '15:00', awo_id: practitioner.id, awo_name: practitioner.name });
      slots.push({ date: dateStr, start_time: '15:30', end_time: '16:30', awo_id: practitioner.id, awo_name: practitioner.name });
    }
  }
  return slots;
}

const MOCK_BOOKINGS: BookingRequest[] = [
  {
    id: 'bk-1',
    awo_id: 'awo-1',
    awo_name: 'Babalawo Adeyemi',
    requested_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    service_type: 'Dafa (Full)',
    status: 'pending',
    proposed_time: null,
    client_message: 'Looking forward to this session',
    awo_response: null,
    consultation_id: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'bk-2',
    awo_id: 'awo-2',
    awo_name: 'Iyanifa Oluwaseun',
    requested_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    service_type: 'Ose Ifa',
    status: 'proposed_new_time',
    proposed_time: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    client_message: null,
    awo_response: 'I have a conflict at that time. Would this alternative work?',
    consultation_id: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'bk-3',
    awo_id: 'awo-1',
    awo_name: 'Babalawo Adeyemi',
    requested_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    service_type: 'Follow-up',
    status: 'accepted',
    proposed_time: null,
    client_message: null,
    awo_response: null,
    consultation_id: 'consult-123',
    payment_status: 'paid',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============ API HELPER ============
async function callClientBookingAPI(action: string, method: string = 'GET', body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const queryParams = new URLSearchParams({ action });
  const url = `${supabaseUrl}/functions/v1/app_awo_scheduling?${queryParams}`;

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
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

// ============ AVAILABILITY CALENDAR ============
function AvailabilityCalendar({
  slots,
  loading,
  clientTimezone,
  onSelectSlot,
  onRefresh,
}: {
  slots: AvailableSlot[];
  loading: boolean;
  clientTimezone: string;
  onSelectSlot: (slot: AvailableSlot) => void;
  onRefresh: () => void;
}) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + 1); // Monday
    return start;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return d;
  });

  const prevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const getSlotsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return slots.filter(s => s.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <Card className="rounded-2xl border-0 shadow-md bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Available Slots
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Globe className="h-3 w-3" />
              {clientTimezone.split('/').pop()?.replace(/_/g, ' ')}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-[10px] text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-[10px] text-muted-foreground">Proposed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-[10px] text-muted-foreground">Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-300" />
            <span className="text-[10px] text-muted-foreground">Unavailable</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
            {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Button variant="ghost" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {weekDays.map((day) => {
                const daySlots = getSlotsForDate(day);
                const past = isPast(day);

                return (
                  <div key={day.toISOString()} className={`rounded-xl border p-3 ${isToday(day) ? 'border-amber-300 bg-amber-50/30' : past ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-medium ${isToday(day) ? 'text-amber-700' : ''}`}>
                        {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      {isToday(day) && <Badge className="text-[10px] bg-amber-100 text-amber-700 rounded-full">Today</Badge>}
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-gray-400">No available slots</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs rounded-lg border-blue-200 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                            disabled={past}
                            onClick={() => onSelectSlot(slot)}
                          >
                            <Clock className="h-3 w-3 mr-1 text-blue-500" />
                            {slot.start_time} - {slot.end_time}
                          </Button>
                        ))}
                      </div>
                    )}
                    {daySlots.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {daySlots[0].awo_name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ============ BOOKING STATUS LIST ============
function BookingStatusList({
  bookings,
  loading,
  onAcceptProposed,
  onDeclineProposed,
  onReschedule,
  onCancel,
}: {
  bookings: BookingRequest[];
  loading: boolean;
  onAcceptProposed: (id: string) => void;
  onDeclineProposed: (id: string) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const navigate = useNavigate();

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 rounded-full text-xs">Pending</Badge>;
      case 'accepted': return <Badge className="bg-green-100 text-green-700 rounded-full text-xs">Accepted</Badge>;
      case 'declined': return <Badge className="bg-red-100 text-red-700 rounded-full text-xs">Declined</Badge>;
      case 'proposed_new_time': return <Badge className="bg-blue-100 text-blue-700 rounded-full text-xs">New Time Proposed</Badge>;
      default: return <Badge variant="secondary" className="rounded-full text-xs">{status}</Badge>;
    }
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarPlus className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No booking requests yet</p>
        <p className="text-xs text-gray-400 mt-1">Select an available slot to book a consultation</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3">
        {bookings.map((booking) => (
          <Card key={booking.id} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{booking.awo_name}</p>
                    <p className="text-xs text-gray-500">{booking.service_type} • {booking.duration_minutes}min</p>
                  </div>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                <Clock className="h-3 w-3" />
                <span>Requested: {formatDateTime(booking.requested_at)}</span>
              </div>

              {booking.payment_status && (
                <div className="flex items-center gap-1 text-xs mb-2">
                  <Badge variant="outline" className="text-[10px] rounded-full">
                    Payment: {booking.payment_status}
                  </Badge>
                </div>
              )}

              {/* Proposed new time */}
              {booking.status === 'proposed_new_time' && booking.proposed_time && (
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-blue-800 mb-1">Practitioner proposed a new time:</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {formatDateTime(booking.proposed_time)}
                  </p>
                  {booking.awo_response && (
                    <p className="text-xs text-blue-700 mt-1 italic">"{booking.awo_response}"</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-7 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onAcceptProposed(booking.id)}
                    >
                      <Check className="h-3 w-3 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => onDeclineProposed(booking.id)}
                    >
                      <X className="h-3 w-3 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Awo response for declined */}
              {booking.status === 'declined' && booking.awo_response && (
                <div className="bg-red-50 rounded-lg p-2 mb-2">
                  <p className="text-xs text-red-700 italic">"{booking.awo_response}"</p>
                </div>
              )}

              {/* Actions for accepted bookings */}
              {booking.status === 'accepted' && booking.consultation_id && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg"
                    onClick={() => navigate(`/consultation/${booking.consultation_id}`)}
                  >
                    View Consultation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => onReschedule(booking.id)}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => onCancel(booking.id)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Pending - can cancel */}
              {booking.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => onCancel(booking.id)}
                  >
                    Cancel Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============ MAIN PAGE ============
export default function ClientBookings() {
  const { user, userRole, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  // Booking dialog state
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingServiceType, setBookingServiceType] = useState('Dafa (Full)');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Cancel/Reschedule dialog
  const [cancelDialog, setCancelDialog] = useState<{ id: string; type: 'cancel' | 'reschedule' } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/client/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    if (!isSupabaseConfigured) {
      setSlots(generateMockSlots());
      setSlotsLoading(false);
      return;
    }
    try {
      const data = await callClientBookingAPI('get-available-slots');
      setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setSlots(generateMockSlots());
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    if (!isSupabaseConfigured) {
      setBookings(MOCK_BOOKINGS);
      setBookingsLoading(false);
      return;
    }
    try {
      const data = await callClientBookingAPI('get-client-bookings');
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setBookings(MOCK_BOOKINGS);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSlots();
      fetchBookings();
    }
  }, [user, fetchSlots, fetchBookings]);

  // ============ ACTIONS ============
  async function handleCreateBooking() {
    if (!selectedSlot) return;
    setSubmittingBooking(true);

    if (!isSupabaseConfigured) {
      // Mock: add to local state
      const newBooking: BookingRequest = {
        id: `bk-${Date.now()}`,
        awo_id: selectedSlot.awo_id,
        awo_name: selectedSlot.awo_name,
        requested_at: `${selectedSlot.date}T${selectedSlot.start_time}:00`,
        duration_minutes: 60,
        service_type: bookingServiceType,
        status: 'pending',
        proposed_time: null,
        client_message: bookingMessage || null,
        awo_response: null,
        consultation_id: null,
        created_at: new Date().toISOString(),
      };
      setBookings(prev => [newBooking, ...prev]);
      toast.success('Booking request sent!');
      setSelectedSlot(null);
      setBookingMessage('');
      setSubmittingBooking(false);
      return;
    }

    try {
      await callClientBookingAPI('create-booking-request', 'POST', {
        awo_id: selectedSlot.awo_id,
        requested_at: `${selectedSlot.date}T${selectedSlot.start_time}:00`,
        duration_minutes: 60,
        service_type: bookingServiceType,
        client_message: bookingMessage || null,
        client_timezone: clientTimezone,
      });
      toast.success('Booking request sent!');
      setSelectedSlot(null);
      setBookingMessage('');
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleAcceptProposed(bookingId: string) {
    if (!isSupabaseConfigured) {
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'accepted' as const, consultation_id: `consult-${Date.now()}` } : b
      ));
      toast.success('Proposed time accepted! Consultation confirmed.');
      return;
    }
    try {
      await callClientBookingAPI('accept-proposed-time', 'POST', { booking_id: bookingId });
      toast.success('Proposed time accepted! Consultation confirmed.');
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept proposed time');
    }
  }

  async function handleDeclineProposed(bookingId: string) {
    if (!isSupabaseConfigured) {
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'declined' as const } : b
      ));
      toast.info('Proposed time declined.');
      return;
    }
    try {
      await callClientBookingAPI('decline-proposed-time', 'POST', { booking_id: bookingId });
      toast.info('Proposed time declined.');
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline');
    }
  }

  async function handleCancel(bookingId: string) {
    if (!isSupabaseConfigured) {
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      toast.success('Consultation cancelled.');
      setCancelDialog(null);
      setCancelReason('');
      return;
    }
    try {
      await callClientBookingAPI('cancel-booking', 'POST', { booking_id: bookingId, reason: cancelReason });
      toast.success('Consultation cancelled.');
      setCancelDialog(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }

  async function handleReschedule(bookingId: string) {
    if (!isSupabaseConfigured) {
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'pending' as const } : b
      ));
      toast.success('Reschedule request submitted.');
      setCancelDialog(null);
      setCancelReason('');
      return;
    }
    try {
      await callClientBookingAPI('reschedule-booking', 'POST', { booking_id: bookingId, reason: cancelReason });
      toast.success('Reschedule request submitted.');
      setCancelDialog(null);
      setCancelReason('');
      fetchBookings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reschedule');
    }
  }

  async function handleLogout() {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/client/auth', { replace: true });
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const proposedCount = bookings.filter(b => b.status === 'proposed_new_time').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Rubik]">Book a Consultation</h1>
          <p className="text-sm text-gray-500">Find available times and manage your bookings</p>
        </div>
        {(pendingCount + proposedCount) > 0 && (
          <Badge className="bg-amber-100 text-amber-700 rounded-full">
            {pendingCount + proposedCount} action{(pendingCount + proposedCount) > 1 ? 's' : ''} needed
          </Badge>
        )}
      </div>
        {/* Action required banner */}
        {proposedCount > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                {proposedCount} booking{proposedCount > 1 ? 's have' : ' has'} a new proposed time
              </p>
              <p className="text-xs text-blue-600">Review and accept or decline below</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="availability" className="space-y-4">
          <TabsList className="bg-white/80 rounded-xl shadow-sm p-1">
            <TabsTrigger value="availability" className="rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
              <Calendar className="h-4 w-4 mr-2" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="bookings" className="rounded-lg data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900">
              <CalendarPlus className="h-4 w-4 mr-2" />
              My Bookings
              {(pendingCount + proposedCount) > 0 && (
                <Badge className="ml-2 bg-red-100 text-red-700 rounded-full text-[10px]">
                  {pendingCount + proposedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="availability">
            <AvailabilityCalendar
              slots={slots}
              loading={slotsLoading}
              clientTimezone={clientTimezone}
              onSelectSlot={(slot) => setSelectedSlot(slot)}
              onRefresh={fetchSlots}
            />
          </TabsContent>

          <TabsContent value="bookings">
            <Card className="rounded-2xl border-0 shadow-md bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-[Rubik] flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5 text-amber-600" />
                  My Booking Requests
                </CardTitle>
                <CardDescription>Track your consultation requests and respond to proposals</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingStatusList
                  bookings={bookings}
                  loading={bookingsLoading}
                  onAcceptProposed={handleAcceptProposed}
                  onDeclineProposed={handleDeclineProposed}
                  onReschedule={(id) => setCancelDialog({ id, type: 'reschedule' })}
                  onCancel={(id) => setCancelDialog({ id, type: 'cancel' })}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      {/* Create Booking Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-amber-600" />
              Book Consultation
            </DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium">{selectedSlot.awo_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">
                    {new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">{selectedSlot.start_time} - {selectedSlot.end_time}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm">Service Type</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Dafa (Full)', 'Ikin Consultation', 'Follow-up', 'Ose Ifa'].map(type => (
                    <Button
                      key={type}
                      variant={bookingServiceType === type ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-lg text-xs ${bookingServiceType === type ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                      onClick={() => setBookingServiceType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm">Message to Practitioner (optional)</Label>
                <Textarea
                  value={bookingMessage}
                  onChange={(e) => setBookingMessage(e.target.value)}
                  placeholder="Any notes or questions for your practitioner..."
                  className="mt-1 rounded-xl"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedSlot(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={submittingBooking}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {submittingBooking ? 'Sending...' : 'Send Booking Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel/Reschedule Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {cancelDialog?.type === 'cancel' ? 'Cancel Consultation' : 'Request Reschedule'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cancelDialog?.type === 'cancel' && (
              <div className="bg-red-50 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <p className="text-xs text-red-700">
                  Cancelling a confirmed consultation may be subject to the practitioner's cancellation policy.
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm">
                {cancelDialog?.type === 'cancel' ? 'Reason for cancellation (optional)' : 'Reason for rescheduling (optional)'}
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={cancelDialog?.type === 'cancel' ? 'Let the practitioner know why...' : 'Explain why you need to reschedule...'}
                className="mt-1 rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelDialog(null)} className="rounded-xl">
              Go Back
            </Button>
            <Button
              variant={cancelDialog?.type === 'cancel' ? 'destructive' : 'default'}
              onClick={() => {
                if (cancelDialog?.type === 'cancel') {
                  handleCancel(cancelDialog.id);
                } else if (cancelDialog) {
                  handleReschedule(cancelDialog.id);
                }
              }}
              className="rounded-xl"
            >
              {cancelDialog?.type === 'cancel' ? 'Confirm Cancellation' : 'Submit Reschedule Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}