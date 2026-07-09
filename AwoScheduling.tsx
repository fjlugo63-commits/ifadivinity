import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Check,
  X,
  MessageSquare,
  RefreshCw,
  Settings,
  Users,
  AlertCircle,
  Globe,
  GripVertical,
  Move,
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventInput, EventDropArg, EventResizeDoneArg, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, DBAvailabilityBlock, DBAvailabilityException, DBBookingRequest, DBConsultation } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ============ TIMEZONE CONSTANTS ============
const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Africa/Accra',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'America/Mexico_City',
];

function getTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return `${tz.replace(/_/g, ' ').split('/').pop()} (${tzName})`;
  } catch {
    return tz;
  }
}

// ============ API HELPER ============
async function callSchedulingAPI(action: string, method: string = 'GET', body?: Record<string, unknown>, params?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const queryParams = new URLSearchParams({ action, ...params });
  const url = `${supabaseUrl}/functions/v1/app_awo_scheduling?${queryParams}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

// ============ CONSTANTS ============
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6;
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

// ============ FULLCALENDAR DRAG-AND-DROP CALENDAR ============
function DragDropCalendar({
  consultations,
  bookings,
  blocks,
  exceptions,
  awoTimezone,
  loading,
  onRefresh,
  onEventDrop,
  onEventResize,
  onDateSelect,
}: {
  consultations: DBConsultation[];
  bookings: { id: string; scheduled_at: string; duration_minutes: number; status: string; service_type: string }[];
  blocks: DBAvailabilityBlock[];
  exceptions: DBAvailabilityException[];
  awoTimezone: string;
  loading: boolean;
  onRefresh: () => void;
  onEventDrop: (info: EventDropArg) => void;
  onEventResize: (info: EventResizeDoneArg) => void;
  onDateSelect: (info: DateSelectArg) => void;
}) {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);

  // Build events for FullCalendar
  const events: EventInput[] = [
    ...consultations.map((c) => ({
      id: `consultation-${c.id}`,
      title: `${c.client_name} - ${c.consultation_type}`,
      start: c.scheduled_at,
      end: new Date(new Date(c.scheduled_at).getTime() + c.duration_minutes * 60000).toISOString(),
      backgroundColor: c.status === 'scheduled' || c.status === 'confirmed' ? '#059669' :
        c.status === 'in_progress' ? '#2563eb' :
        c.status === 'completed' ? '#6b7280' : '#d97706',
      borderColor: c.status === 'scheduled' || c.status === 'confirmed' ? '#047857' :
        c.status === 'in_progress' ? '#1d4ed8' :
        c.status === 'completed' ? '#4b5563' : '#b45309',
      textColor: '#ffffff',
      extendedProps: {
        type: 'consultation',
        status: c.status,
        consultationId: c.id,
        editable: c.status === 'scheduled' || c.status === 'confirmed',
      },
    })),
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      title: `Booking - ${b.service_type}`,
      start: b.scheduled_at,
      end: new Date(new Date(b.scheduled_at).getTime() + (b.duration_minutes || 60) * 60000).toISOString(),
      backgroundColor: '#4f46e5',
      borderColor: '#4338ca',
      textColor: '#ffffff',
      extendedProps: {
        type: 'booking',
        status: b.status,
        editable: b.status === 'scheduled' || b.status === 'confirmed',
      },
    })),
  ];

  // Add availability background events
  const today = new Date();
  for (let i = -7; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const exception = exceptions.find(e => e.exception_date === dateStr);
    if (exception?.exception_type === 'day_off') {
      events.push({
        id: `dayoff-${dateStr}`,
        title: 'Day Off',
        start: dateStr,
        allDay: true,
        display: 'background',
        backgroundColor: '#fecaca',
      });
      continue;
    }

    const dayBlocks = blocks.filter(b => b.day_of_week === dayOfWeek && !b.is_break);
    for (const block of dayBlocks) {
      events.push({
        id: `avail-${dateStr}-${block.id}`,
        start: `${dateStr}T${block.start_time}:00`,
        end: `${dateStr}T${block.end_time}:00`,
        display: 'background',
        backgroundColor: '#d1fae5',
        extendedProps: { type: 'availability', blockId: block.id },
      });
    }

    const dayBreaks = blocks.filter(b => b.day_of_week === dayOfWeek && b.is_break);
    for (const brk of dayBreaks) {
      events.push({
        id: `break-${dateStr}-${brk.id}`,
        start: `${dateStr}T${brk.start_time}:00`,
        end: `${dateStr}T${brk.end_time}:00`,
        display: 'background',
        backgroundColor: '#fef3c7',
      });
    }
  }

  const handleEventClick = (info: EventClickArg) => {
    const props = info.event.extendedProps;
    if (props.type === 'consultation' && props.consultationId) {
      navigate(`/consultation/${props.consultationId}`);
    }
  };

  if (loading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Globe className="h-3 w-3" />
              {getTimezoneLabel(awoTimezone)}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-600" />
            <span className="text-[10px] text-muted-foreground">Consultation</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-indigo-600" />
            <span className="text-[10px] text-muted-foreground">Booking</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-[10px] text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            <span className="text-[10px] text-muted-foreground">Break</span>
          </div>
          <div className="flex items-center gap-1">
            <Move className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Drag to reschedule</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="fc-custom-styles">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            slotMinTime="06:00:00"
            slotMaxTime="21:00:00"
            slotDuration="00:30:00"
            allDaySlot={true}
            nowIndicator={true}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
            select={onDateSelect}
            eventClick={handleEventClick}
            timeZone={awoTimezone}
            height="auto"
            aspectRatio={1.5}
            eventDidMount={(info) => {
              const props = info.event.extendedProps;
              if (props.editable === false) {
                info.el.style.cursor = 'default';
              } else if (info.event.display !== 'background') {
                info.el.style.cursor = 'grab';
              }
            }}
            eventAllow={(dropInfo, draggedEvent) => {
              const props = draggedEvent?.extendedProps;
              return props?.editable !== false;
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============ AVAILABILITY EDITOR ============
function AvailabilityEditor({
  blocks,
  exceptions,
  awoTimezone,
  loading,
  onSave,
  onAddException,
  onDeleteException,
  onTimezoneChange,
}: {
  blocks: DBAvailabilityBlock[];
  exceptions: DBAvailabilityException[];
  awoTimezone: string;
  loading: boolean;
  onSave: (blocks: Partial<DBAvailabilityBlock>[]) => Promise<void>;
  onAddException: (exception: { exception_date: string; exception_type: string; start_time?: string; end_time?: string; reason?: string }) => Promise<void>;
  onDeleteException: (id: string) => Promise<void>;
  onTimezoneChange: (tz: string) => Promise<void>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editBlocks, setEditBlocks] = useState<Partial<DBAvailabilityBlock>[]>([]);
  const [saving, setSaving] = useState(false);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [newException, setNewException] = useState({ exception_date: '', exception_type: 'day_off', start_time: '', end_time: '', reason: '' });
  const [showTzDialog, setShowTzDialog] = useState(false);
  const [selectedTz, setSelectedTz] = useState(awoTimezone);

  useEffect(() => {
    if (editMode) {
      setEditBlocks(blocks.map(b => ({ ...b })));
    }
  }, [editMode, blocks]);

  useEffect(() => {
    setSelectedTz(awoTimezone);
  }, [awoTimezone]);

  const handleAddBlock = (dayOfWeek: number) => {
    setEditBlocks([...editBlocks, { day_of_week: dayOfWeek, start_time: '09:00', end_time: '17:00', is_break: false }]);
  };

  const handleRemoveBlock = (index: number) => {
    setEditBlocks(editBlocks.filter((_, i) => i !== index));
  };

  const handleBlockChange = (index: number, field: string, value: string | boolean) => {
    const updated = [...editBlocks];
    updated[index] = { ...updated[index], [field]: value };
    setEditBlocks(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editBlocks);
      setEditMode(false);
      toast.success('Availability saved');
    } catch {
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleAddException = async () => {
    try {
      await onAddException(newException);
      setShowExceptionDialog(false);
      setNewException({ exception_date: '', exception_type: 'day_off', start_time: '', end_time: '', reason: '' });
      toast.success('Exception added');
    } catch {
      toast.error('Failed to add exception');
    }
  };

  const handleTzSave = async () => {
    try {
      await onTimezoneChange(selectedTz);
      setShowTzDialog(false);
      toast.success('Timezone updated');
    } catch {
      toast.error('Failed to update timezone');
    }
  };

  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  // Group blocks by day
  const blocksByDay: Record<number, Partial<DBAvailabilityBlock>[]> = {};
  const displayBlocks = editMode ? editBlocks : blocks;
  for (const block of displayBlocks) {
    const day = block.day_of_week ?? 0;
    if (!blocksByDay[day]) blocksByDay[day] = [];
    blocksByDay[day].push(block);
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Availability
            </CardTitle>
            <div className="flex items-center gap-1">
              {editMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
              )}
            </div>
          </div>
          <CardDescription className="flex items-center gap-2 mt-1">
            <Globe className="h-3 w-3" />
            <span className="text-xs">Timezone: {getTimezoneLabel(awoTimezone)}</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowTzDialog(true)}>
              Change
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-420px)]">
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                const dayBlocksList = blocksByDay[dayIdx] || [];
                const hasBlocks = dayBlocksList.length > 0;

                return (
                  <div key={dayIdx} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{dayName}</span>
                      {editMode && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddBlock(dayIdx)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {!hasBlocks && (
                      <span className="text-xs text-muted-foreground">No availability set</span>
                    )}
                    <div className="space-y-1.5">
                      {dayBlocksList.map((block, blockIdx) => {
                        const globalIdx = editBlocks.indexOf(block);
                        return (
                          <div key={blockIdx} className="flex items-center gap-2">
                            {editMode && (
                              <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                            )}
                            {editMode ? (
                              <>
                                <Select
                                  value={block.start_time || '09:00'}
                                  onValueChange={(v) => handleBlockChange(globalIdx, 'start_time', v)}
                                >
                                  <SelectTrigger className="h-7 w-20 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map(t => (
                                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-xs">-</span>
                                <Select
                                  value={block.end_time || '17:00'}
                                  onValueChange={(v) => handleBlockChange(globalIdx, 'end_time', v)}
                                >
                                  <SelectTrigger className="h-7 w-20 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map(t => (
                                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                  <Switch
                                    checked={block.is_break || false}
                                    onCheckedChange={(v) => handleBlockChange(globalIdx, 'is_break', v)}
                                    className="scale-75"
                                  />
                                  <span className="text-[10px] text-muted-foreground">Break</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveBlock(globalIdx)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant={block.is_break ? 'secondary' : 'default'} className="text-xs">
                                  {block.start_time} - {block.end_time}
                                </Badge>
                                {block.is_break && <span className="text-[10px] text-amber-600">Break</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Exceptions */}
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Date Exceptions</h4>
                <Button variant="outline" size="sm" onClick={() => setShowExceptionDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {exceptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No exceptions set</p>
              )}
              {exceptions.map((exc) => (
                <div key={exc.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <span className="text-xs font-medium">{exc.exception_date}</span>
                    <Badge variant={exc.exception_type === 'day_off' ? 'destructive' : 'secondary'} className="ml-2 text-[10px]">
                      {exc.exception_type === 'day_off' ? 'Day Off' : exc.exception_type === 'extended_hours' ? 'Extended' : 'Special'}
                    </Badge>
                    {exc.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{exc.reason}</p>}
                    {exc.start_time && <span className="text-[10px] text-muted-foreground ml-2">{exc.start_time}-{exc.end_time}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteException(exc.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Exception Dialog */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Date Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={newException.exception_date} onChange={(e) => setNewException({ ...newException, exception_date: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newException.exception_type} onValueChange={(v) => setNewException({ ...newException, exception_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_off">Day Off</SelectItem>
                  <SelectItem value="extended_hours">Extended Hours</SelectItem>
                  <SelectItem value="special_window">Special Window</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newException.exception_type !== 'day_off' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Start Time</Label>
                  <Select value={newException.start_time} onValueChange={(v) => setNewException({ ...newException, start_time: v })}>
                    <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>End Time</Label>
                  <Select value={newException.end_time} onValueChange={(v) => setNewException({ ...newException, end_time: v })}>
                    <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div>
              <Label>Reason (optional)</Label>
              <Input value={newException.reason} onChange={(e) => setNewException({ ...newException, reason: e.target.value })} placeholder="e.g., Holiday, Personal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowExceptionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddException} disabled={!newException.exception_date}>Add Exception</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timezone Dialog */}
      <Dialog open={showTzDialog} onOpenChange={setShowTzDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Timezone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select your timezone. All calendar events and availability will be displayed in this timezone.
            </p>
            <Select value={selectedTz} onValueChange={setSelectedTz}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{getTimezoneLabel(tz)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTzDialog(false)}>Cancel</Button>
            <Button onClick={handleTzSave}>Save Timezone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ BOOKING REQUESTS PANEL ============
function BookingRequestsPanel({
  requests,
  awoTimezone,
  loading,
  onAccept,
  onDecline,
  onProposeNewTime,
  onRefresh,
}: {
  requests: DBBookingRequest[];
  awoTimezone: string;
  loading: boolean;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string, reason: string) => Promise<void>;
  onProposeNewTime: (id: string, time: string, message: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [activeAction, setActiveAction] = useState<{ id: string; type: 'decline' | 'propose' } | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [proposedMessage, setProposedMessage] = useState('');

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  const formatRequestTime = (request: DBBookingRequest) => {
    try {
      const date = new Date(request.requested_at);
      return date.toLocaleString('en-US', {
        timeZone: awoTimezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return request.requested_at;
    }
  };

  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-420px)]">
            {requests.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No booking requests</p>
              </div>
            )}

            {/* Pending */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3 mb-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Pending</h4>
                {pendingRequests.map((req) => (
                  <div key={req.id} className="border rounded-lg p-3 space-y-2 bg-amber-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{req.client_name || 'Client'}</p>
                        <p className="text-xs text-muted-foreground">{req.service_type} • {req.duration_minutes}min</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{formatRequestTime(req)}</span>
                      <span className="text-muted-foreground ml-1">(Your time)</span>
                    </div>
                    {req.client_timezone && req.client_timezone !== awoTimezone && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        Client TZ: {req.client_timezone.split('/').pop()?.replace(/_/g, ' ')}
                      </div>
                    )}
                    {req.client_message && (
                      <div className="flex items-start gap-1 text-xs bg-muted/50 rounded p-2">
                        <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{req.client_message}</span>
                      </div>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" className="h-7 text-xs" onClick={() => onAccept(req.id)}>
                        <Check className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setActiveAction({ id: req.id, type: 'decline' })}>
                        <X className="h-3 w-3 mr-1" /> Decline
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActiveAction({ id: req.id, type: 'propose' })}>
                        <Clock className="h-3 w-3 mr-1" /> Propose
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other */}
            {otherRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">History</h4>
                {otherRequests.slice(0, 10).map((req) => (
                  <div key={req.id} className="border rounded p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{req.client_name || 'Client'}</span>
                      <Badge
                        variant={req.status === 'accepted' ? 'default' : req.status === 'declined' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{formatRequestTime(req)}</p>
                    {req.awo_response && (
                      <p className="text-[10px] text-muted-foreground italic">{req.awo_response}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Decline Dialog */}
      <Dialog open={activeAction?.type === 'decline'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Booking Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Let the client know why..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (activeAction) {
                onDecline(activeAction.id, declineReason);
                setActiveAction(null);
                setDeclineReason('');
              }
            }}>Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Propose Dialog */}
      <Dialog open={activeAction?.type === 'propose'} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose New Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Propose a new time in your timezone ({getTimezoneLabel(awoTimezone)}). It will be automatically converted for the client.
            </p>
            <div>
              <Label>Proposed Date & Time</Label>
              <Input type="datetime-local" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} />
            </div>
            <div>
              <Label>Message (optional)</Label>
              <Textarea value={proposedMessage} onChange={(e) => setProposedMessage(e.target.value)} placeholder="Suggest an alternative..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button onClick={() => {
              if (activeAction && proposedTime) {
                onProposeNewTime(activeAction.id, proposedTime, proposedMessage);
                setActiveAction(null);
                setProposedTime('');
                setProposedMessage('');
              }
            }} disabled={!proposedTime}>Propose</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ MAIN PAGE ============
export default function AwoScheduling() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [blocks, setBlocks] = useState<DBAvailabilityBlock[]>([]);
  const [exceptions, setExceptions] = useState<DBAvailabilityException[]>([]);
  const [consultations, setConsultations] = useState<DBConsultation[]>([]);
  const [bookings, setBookings] = useState<{ id: string; scheduled_at: string; duration_minutes: number; status: string; service_type: string }[]>([]);
  const [requests, setRequests] = useState<DBBookingRequest[]>([]);
  const [awoTimezone, setAwoTimezone] = useState('America/New_York');

  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [activeTab, setActiveTab] = useState('calendar');

  const fetchAvailability = useCallback(async () => {
    setLoadingAvailability(true);
    try {
      const data = await callSchedulingAPI('get-availability');
      setBlocks(data.blocks || []);
      setExceptions(data.exceptions || []);
      if (data.awo_timezone) setAwoTimezone(data.awo_timezone);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
      const data = await callSchedulingAPI('get-calendar', 'GET', undefined, { start, end });
      setConsultations(data.consultations || []);
      setBookings(data.bookings || []);
      if (data.awo_timezone) setAwoTimezone(data.awo_timezone);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoadingCalendar(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await callSchedulingAPI('get-booking-requests', 'GET', undefined, { status: 'all' });
      setRequests(data.requests || []);
      if (data.awo_timezone) setAwoTimezone(data.awo_timezone);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (user && (userRole === 'seller' || userRole === 'admin')) {
      fetchAvailability();
      fetchCalendar();
      fetchRequests();
    }
  }, [user, userRole, fetchAvailability, fetchCalendar, fetchRequests]);

  const handleSaveAvailability = async (newBlocks: Partial<DBAvailabilityBlock>[]) => {
    await callSchedulingAPI('save-availability', 'POST', { blocks: newBlocks });
    await fetchAvailability();
  };

  const handleAddException = async (exception: { exception_date: string; exception_type: string; start_time?: string; end_time?: string; reason?: string }) => {
    await callSchedulingAPI('save-exception', 'POST', exception);
    await fetchAvailability();
  };

  const handleDeleteException = async (id: string) => {
    await callSchedulingAPI('delete-exception', 'POST', { exception_id: id });
    await fetchAvailability();
    toast.success('Exception removed');
  };

  const handleTimezoneChange = async (tz: string) => {
    await callSchedulingAPI('update-timezone', 'POST', { timezone: tz });
    setAwoTimezone(tz);
    // Refresh all data with new timezone context
    await Promise.all([fetchAvailability(), fetchCalendar(), fetchRequests()]);
  };

  const handleAcceptBooking = async (requestId: string) => {
    try {
      await callSchedulingAPI('accept-booking', 'POST', { request_id: requestId });
      toast.success('Booking accepted! Consultation created.');
      fetchRequests();
      fetchCalendar();
    } catch {
      toast.error('Failed to accept booking');
    }
  };

  const handleDeclineBooking = async (requestId: string, reason: string) => {
    try {
      await callSchedulingAPI('decline-booking', 'POST', { request_id: requestId, reason });
      toast.success('Booking declined');
      fetchRequests();
    } catch {
      toast.error('Failed to decline booking');
    }
  };

  const handleProposeNewTime = async (requestId: string, proposedTime: string, message: string) => {
    try {
      await callSchedulingAPI('propose-new-time', 'POST', { request_id: requestId, proposed_time: proposedTime, message });
      toast.success('New time proposed to client');
      fetchRequests();
    } catch {
      toast.error('Failed to propose new time');
    }
  };

  // Drag-and-drop handlers
  const handleEventDrop = async (info: EventDropArg) => {
    const eventId = info.event.id;
    const props = info.event.extendedProps;

    if (props.editable === false) {
      info.revert();
      toast.error('Cannot move completed or cancelled events');
      return;
    }

    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString();

    if (!newStart) {
      info.revert();
      return;
    }

    try {
      if (props.type === 'consultation') {
        const realId = eventId.replace('consultation-', '');
        await callSchedulingAPI('reschedule-event', 'POST', {
          event_id: realId,
          event_type: 'consultation',
          new_start: newStart,
          new_end: newEnd,
        });
        toast.success('Consultation rescheduled');
      } else if (props.type === 'booking') {
        const realId = eventId.replace('booking-', '');
        await callSchedulingAPI('reschedule-event', 'POST', {
          event_id: realId,
          event_type: 'booking',
          new_start: newStart,
          new_end: newEnd,
        });
        toast.success('Booking rescheduled');
      }
      fetchCalendar();
    } catch {
      info.revert();
      toast.error('Failed to reschedule event');
    }
  };

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const eventId = info.event.id;
    const props = info.event.extendedProps;

    if (props.editable === false) {
      info.revert();
      return;
    }

    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString();

    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    try {
      if (props.type === 'consultation') {
        const realId = eventId.replace('consultation-', '');
        await callSchedulingAPI('reschedule-event', 'POST', {
          event_id: realId,
          event_type: 'consultation',
          new_start: newStart,
          new_end: newEnd,
        });
        toast.success('Event duration updated');
      } else if (props.type === 'booking') {
        const realId = eventId.replace('booking-', '');
        await callSchedulingAPI('reschedule-event', 'POST', {
          event_id: realId,
          event_type: 'booking',
          new_start: newStart,
          new_end: newEnd,
        });
        toast.success('Event duration updated');
      }
      fetchCalendar();
    } catch {
      info.revert();
      toast.error('Failed to update event');
    }
  };

  const handleDateSelect = (info: DateSelectArg) => {
    // When user selects a time range on the calendar, show a quick action
    toast.info(`Selected: ${info.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${info.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, {
      description: 'Use the Availability Editor to set recurring blocks.',
      duration: 3000,
    });
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-[600px]" />
        </main>
        <Footer />
      </div>
    );
  }

  const isAuthorized = user && (userRole === 'seller' || userRole === 'admin');

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-8 text-center">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-bold text-lg mb-2">Awo Access Required</h3>
              <p className="text-muted-foreground text-sm mb-4">
                The Scheduling module is only available to registered Awo practitioners.
              </p>
              <Button onClick={() => navigate(user ? '/' : '/auth')}>
                {user ? 'Return Home' : 'Sign In'}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Scheduling</h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
              Manage your availability, calendar, and booking requests.
              <Badge variant="outline" className="text-[10px] gap-1">
                <Globe className="h-3 w-3" />
                {getTimezoneLabel(awoTimezone)}
              </Badge>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/awo/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="calendar" className="flex-1">Calendar</TabsTrigger>
              <TabsTrigger value="availability" className="flex-1">Availability</TabsTrigger>
              <TabsTrigger value="requests" className="flex-1">
                Requests
                {requests.filter((r) => r.status === 'pending').length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                    {requests.filter((r) => r.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Desktop: Three-panel layout */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6">
          {/* Calendar - 7 cols (wider for FullCalendar) */}
          <div className="col-span-7">
            <DragDropCalendar
              consultations={consultations}
              bookings={bookings}
              blocks={blocks}
              exceptions={exceptions}
              awoTimezone={awoTimezone}
              loading={loadingCalendar}
              onRefresh={fetchCalendar}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onDateSelect={handleDateSelect}
            />
          </div>

          {/* Availability Editor - 3 cols */}
          <div className="col-span-3">
            <AvailabilityEditor
              blocks={blocks}
              exceptions={exceptions}
              awoTimezone={awoTimezone}
              loading={loadingAvailability}
              onSave={handleSaveAvailability}
              onAddException={handleAddException}
              onDeleteException={handleDeleteException}
              onTimezoneChange={handleTimezoneChange}
            />
          </div>

          {/* Booking Requests - 2 cols */}
          <div className="col-span-2">
            <BookingRequestsPanel
              requests={requests}
              awoTimezone={awoTimezone}
              loading={loadingRequests}
              onAccept={handleAcceptBooking}
              onDecline={handleDeclineBooking}
              onProposeNewTime={handleProposeNewTime}
              onRefresh={fetchRequests}
            />
          </div>
        </div>

        {/* Mobile: Tab content */}
        <div className="lg:hidden">
          {activeTab === 'calendar' && (
            <DragDropCalendar
              consultations={consultations}
              bookings={bookings}
              blocks={blocks}
              exceptions={exceptions}
              awoTimezone={awoTimezone}
              loading={loadingCalendar}
              onRefresh={fetchCalendar}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onDateSelect={handleDateSelect}
            />
          )}
          {activeTab === 'availability' && (
            <AvailabilityEditor
              blocks={blocks}
              exceptions={exceptions}
              awoTimezone={awoTimezone}
              loading={loadingAvailability}
              onSave={handleSaveAvailability}
              onAddException={handleAddException}
              onDeleteException={handleDeleteException}
              onTimezoneChange={handleTimezoneChange}
            />
          )}
          {activeTab === 'requests' && (
            <BookingRequestsPanel
              requests={requests}
              awoTimezone={awoTimezone}
              loading={loadingRequests}
              onAccept={handleAcceptBooking}
              onDecline={handleDeclineBooking}
              onProposeNewTime={handleProposeNewTime}
              onRefresh={fetchRequests}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}