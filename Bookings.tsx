import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Video, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES, DBProfile } from '@/lib/supabase';
import { toast } from 'sonner';

interface TimeSlot {
  time: string;
  available: boolean;
}

// Helper to call the scheduling edge function
async function callSchedulingAPI(action: string, params?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const queryParams = new URLSearchParams({ action, ...params });
  const url = `${supabaseUrl}/functions/v1/app_awo_scheduling?${queryParams}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

async function createBookingRequest(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/app_awo_scheduling?action=create-booking-request`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create booking request');
  return data;
}

export default function BookingsPage() {
  const { user } = useAuth();
  const [practitioners, setPractitioners] = useState<DBProfile[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientMessage, setClientMessage] = useState('');

  // Demo practitioners shown when no real seller profiles exist
  const demoPractitioners: DBProfile[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'babalawo.adeyemi@ifamarket.com',
      full_name: 'Chief Babalawo Adeyemi',
      role: 'seller',
      bio: 'Senior Babalawo with over 30 years of experience in Ifa divination. Initiated in Ile-Ife, Nigeria. Specializes in Odu interpretation, spiritual counseling, and traditional healing.',
      phone: '+234-801-234-5678',
      avatar_url: null,
      verified_egbo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'iyanifa.olayinka@ifamarket.com',
      full_name: 'Iyanifa Olayinka Adesanya',
      role: 'seller',
      bio: 'Iyanifa (female Ifa priest) with 15 years of practice. Expert in Ori consultations, spiritual baths, and women\'s spiritual wellness. Based in Lagos, Nigeria.',
      phone: '+234-802-345-6789',
      avatar_url: null,
      verified_egbo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'babalawo.marcus@ifamarket.com',
      full_name: 'Babalawo Marcus Thompson',
      role: 'seller',
      bio: 'American-born Babalawo initiated in Cuba through the Lucumi tradition. 20 years of experience bridging Yoruba and diaspora spiritual practices. Fluent in English and Spanish.',
      phone: '+1-305-555-0123',
      avatar_url: null,
      verified_egbo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    fetchPractitioners();
  }, []);

  async function fetchPractitioners() {
    try {
      const { data, error } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .eq('role', 'seller');
      if (!error && data && data.length > 0) {
        setPractitioners(data);
      } else {
        setPractitioners(demoPractitioners);
      }
    } catch {
      setPractitioners(demoPractitioners);
    }
  }

  // Fetch available slots when practitioner + date selected
  const fetchAvailableSlots = useCallback(async (awoId: string, date: string) => {
    // For demo practitioners, generate random slots
    if (awoId.startsWith('00000000-0000-0000-0000-')) {
      const slots: TimeSlot[] = [];
      for (const time of ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']) {
        slots.push({ time, available: Math.random() > 0.3 });
      }
      setTimeSlots(slots);
      return;
    }

    setLoadingSlots(true);
    try {
      const data = await callSchedulingAPI('get-available-slots', { awo_id: awoId, date });
      setTimeSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      // Fallback to default slots
      const slots: TimeSlot[] = [];
      for (const time of ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']) {
        slots.push({ time, available: true });
      }
      setTimeSlots(slots);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPractitioner && selectedDate) {
      fetchAvailableSlots(selectedPractitioner, selectedDate);
      setSelectedTime('');
    }
  }, [selectedPractitioner, selectedDate, fetchAvailableSlots]);

  // Generate next 7 available dates
  const getAvailableDates = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let d = 1; d <= 14; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      // Skip Sundays for demo practitioners
      if (selectedPractitioner.startsWith('00000000-0000-0000-0000-') && date.getDay() === 0) continue;
      dates.push(date.toISOString().split('T')[0]);
      if (dates.length >= 7) break;
    }
    return dates;
  };

  const availableDates = getAvailableDates();

  async function handleBooking() {
    if (!user) {
      toast.error('Please sign in to book a reading');
      return;
    }
    if (!selectedPractitioner || !selectedDate || !selectedTime) {
      toast.error('Please select a practitioner, date, and time');
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const isDemoPractitioner = selectedPractitioner.startsWith('00000000-0000-0000-0000-');

      if (isDemoPractitioner) {
        // For demo practitioners, use the old direct booking via edge function
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('No active session. Please sign in again.');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/app_book_consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            practitioner_id: null,
            service_type: 'ifa_reading',
            scheduled_at: scheduledAt,
            duration_minutes: 60,
            price: 75.00,
            meeting_url: `https://meet.ifamarket.com/${Date.now()}`,
            notes: clientMessage || null,
          }),
        });

        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error || result.details || 'Booking failed');
        }
      } else {
        // For real practitioners, create a booking request through the scheduling system
        await createBookingRequest({
          awo_id: selectedPractitioner,
          requested_at: scheduledAt,
          duration_minutes: 60,
          service_type: 'ifa_reading',
          message: clientMessage || null,
        });
      }

      setBookingConfirmed(true);
      toast.success(isDemoPractitioner ? 'Reading booked successfully!' : 'Booking request sent! The practitioner will confirm shortly.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Booking failed:', message);
      toast.error(`Failed to book reading: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  if (bookingConfirmed) {
    const practitioner = practitioners.find((p) => p.id === selectedPractitioner);
    const isDemoPractitioner = selectedPractitioner.startsWith('00000000-0000-0000-0000-');

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="p-8 space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
              <h2 className="text-2xl font-heading font-bold">
                {isDemoPractitioner ? 'Booking Confirmed!' : 'Request Sent!'}
              </h2>
              <p className="text-muted-foreground">
                {isDemoPractitioner ? (
                  <>
                    Your reading with{' '}
                    <strong>{practitioner?.full_name || 'Practitioner'}</strong>{' '}
                    is scheduled for{' '}
                    <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>{' '}
                    at <strong>{selectedTime}</strong>.
                  </>
                ) : (
                  <>
                    Your booking request with{' '}
                    <strong>{practitioner?.full_name || 'Practitioner'}</strong>{' '}
                    for{' '}
                    <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>{' '}
                    at <strong>{selectedTime}</strong> has been sent.
                    You'll receive a notification once the practitioner confirms.
                  </>
                )}
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 justify-center text-sm">
                  <Video className="h-4 w-4" />
                  <span>
                    {isDemoPractitioner
                      ? 'Meeting link will be sent to your email'
                      : 'Meeting details will be shared after confirmation'}
                  </span>
                </div>
              </div>
              <Button onClick={() => { setBookingConfirmed(false); setSelectedTime(''); setSelectedDate(''); }} variant="outline">
                Book Another Reading
              </Button>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-heading font-bold mb-2">Book a Reading</h1>
          <p className="text-muted-foreground mb-8">
            Connect with verified Ifa practitioners for personal divination readings via video call.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Practitioner Selection */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Choose a Practitioner</h2>
              {practitioners.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No practitioners available yet. Check back soon!
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {practitioners.map((p) => (
                    <Card
                      key={p.id}
                      className={`cursor-pointer transition-all ${selectedPractitioner === p.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                      onClick={() => { setSelectedPractitioner(p.id); setSelectedDate(''); setSelectedTime(''); }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <span className="text-lg">👤</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{p.full_name || p.email}</h3>
                              <Badge variant="secondary" className="text-xs">Verified</Badge>
                            </div>
                            {p.bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.bio}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Date & Time Selection */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Date & Time</CardTitle>
                  <CardDescription>1-hour video consultation - $75</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Date
                    </label>
                    <Select
                      value={selectedDate}
                      onValueChange={(v) => { setSelectedDate(v); setSelectedTime(''); }}
                      disabled={!selectedPractitioner}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedPractitioner ? "Select a date" : "Select a practitioner first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map((date) => (
                          <SelectItem key={date} value={date}>
                            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDate && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Available Times
                      </label>
                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading availability...</span>
                        </div>
                      ) : timeSlots.filter((s) => s.available).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No available slots on this date. Try another day.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {timeSlots.filter((s) => s.available).map((slot) => (
                            <Button
                              key={slot.time}
                              variant={selectedTime === slot.time ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setSelectedTime(slot.time)}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTime && (
                    <div className="space-y-2">
                      <Label className="text-sm">Message to Practitioner (optional)</Label>
                      <Textarea
                        value={clientMessage}
                        onChange={(e) => setClientMessage(e.target.value)}
                        placeholder="Describe what you'd like guidance on..."
                        className="h-20"
                      />
                    </div>
                  )}

                  <Separator />

                  <Button
                    onClick={handleBooking}
                    className="w-full"
                    disabled={!selectedPractitioner || !selectedDate || !selectedTime || loading}
                  >
                    {loading ? 'Booking...' : selectedPractitioner.startsWith('00000000-0000-0000-0000-') ? 'Confirm Booking - $75' : 'Send Booking Request - $75'}
                  </Button>

                  {!selectedPractitioner.startsWith('00000000-0000-0000-0000-') && selectedPractitioner && (
                    <p className="text-xs text-muted-foreground text-center">
                      The practitioner will review and confirm your booking request.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}