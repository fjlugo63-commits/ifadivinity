import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Bell,
  Users,
  Play,
  Clock,
  ListChecks,
  UserCircle,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Megaphone,
  FileSearch,
  BellOff,
  DollarSign,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, DBConsultation, DBNotification, DBIfaHouse, DBAnnouncement } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Helper to call the edge function
async function callDashboardAPI(action: string, method: string = 'GET', body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/app_awo_dashboard?action=${action}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
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
  return date.toLocaleDateString();
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

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'scheduled': return 'default';
    case 'confirmed': return 'default';
    case 'in_progress': return 'secondary';
    case 'completed': return 'outline';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'new_booking': return <Calendar className="h-4 w-4 text-blue-500" />;
    case 'cancellation': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'ebo_acceptance': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'payment': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    default: return <Bell className="h-4 w-4 text-amber-500" />;
  }
}

// ============ UPCOMING CONSULTATIONS PANEL ============
function UpcomingConsultationsPanel({
  consultations,
  loading,
  onReschedule,
  onCancel,
  onRefresh,
}: {
  consultations: DBConsultation[];
  loading: boolean;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Consultations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming Consultations
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          {consultations.length} upcoming {consultations.length === 1 ? 'session' : 'sessions'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-320px)]">
          {consultations.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No upcoming consultations</p>
              <p className="text-xs text-muted-foreground mt-1">
                New bookings will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-2">
              {consultations.map((consultation) => (
                <Card key={consultation.id} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{consultation.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getConsultationTypeLabel(consultation.consultation_type)}
                        </p>
                      </div>
                      <Badge variant={getStatusBadgeVariant(consultation.status)} className="text-xs">
                        {consultation.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" />
                      <span>{formatDateTime(consultation.scheduled_at)}</span>
                      <span>• {consultation.duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-7"
                        onClick={() => navigate(`/consultation/${consultation.id}`)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Open Workspace
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => onReschedule(consultation.id)}
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-destructive hover:text-destructive"
                        onClick={() => onCancel(consultation.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============ QUICK ACTIONS PANEL ============
function QuickActionsPanel({
  entitlements,
  loading,
}: {
  entitlements: string[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Start New Consultation',
      icon: Play,
      color: 'bg-primary text-primary-foreground hover:bg-primary/90',
      onClick: () => navigate('/awo/consultation/new'),
      entitlement: null, // Always available
    },
    {
      label: "View Today's Schedule",
      icon: Calendar,
      color: 'bg-amber-600 text-white hover:bg-amber-700',
      onClick: () => navigate('/awo/schedule'),
      entitlement: null,
    },
    {
      label: 'Open Client List',
      icon: Users,
      color: 'bg-indigo-600 text-white hover:bg-indigo-700',
      onClick: () => navigate('/awo/clients'),
      entitlement: null,
    },
    {
      label: 'View Past Consultations',
      icon: FileSearch,
      color: 'bg-teal-600 text-white hover:bg-teal-700',
      onClick: () => navigate('/awo/history'),
      entitlement: null,
    },
    {
      label: 'Review Pending Ebo',
      icon: ListChecks,
      color: 'bg-emerald-600 text-white hover:bg-emerald-700',
      onClick: () => navigate('/awo/pending-ebo'),
      entitlement: 'egbo_services',
    },
    {
      label: 'Manage Payments',
      icon: DollarSign,
      color: 'bg-amber-600 text-white hover:bg-amber-700',
      onClick: () => navigate('/awo/payments'),
      entitlement: null,
    },
    {
      label: 'Client Messages',
      icon: MessageSquare,
      color: 'bg-purple-600 text-white hover:bg-purple-700',
      onClick: () => navigate('/awo/messages'),
      entitlement: null,
    },
  ];

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Play className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common tasks and workflows</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => {
            const isDisabled = action.entitlement && !entitlements.includes(action.entitlement);
            const Icon = action.icon;

            return (
              <Button
                key={action.label}
                className={`w-full justify-start h-12 ${isDisabled ? 'opacity-50 cursor-not-allowed' : action.color}`}
                variant={isDisabled ? 'outline' : 'default'}
                disabled={isDisabled}
                onClick={action.onClick}
              >
                <Icon className="h-5 w-5 mr-3" />
                <span className="text-sm font-medium">{action.label}</span>
                {isDisabled && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Upgrade Required
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        <Separator className="my-6" />

        {/* Dashboard Stats */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Today's Overview</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">—</p>
              <p className="text-xs text-muted-foreground">Sessions Today</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">—</p>
              <p className="text-xs text-muted-foreground">Pending Ebo</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ NOTIFICATIONS PANEL ============
function NotificationsPanel({
  notifications,
  loading,
  onMarkRead,
  onClearAll,
  onRefresh,
}: {
  notifications: DBNotification[];
  loading: boolean;
  onMarkRead: (ids: string[]) => void;
  onClearAll: () => void;
  onRefresh: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs ml-1">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearAll} className="text-xs h-7">
                <BellOff className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh" className="h-7 w-7">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-320px)]">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be notified of new bookings and updates
              </p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    notification.is_read
                      ? 'bg-background border-border'
                      : 'bg-primary/5 border-primary/20'
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      onMarkRead([notification.id]);
                    }
                  }}
                >
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notification.is_read ? 'font-normal' : 'font-medium'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============ HOUSE VISIBILITY PANEL ============
function HouseVisibilityPanel({
  houseData,
  loading,
}: {
  houseData: {
    has_house: boolean;
    entitled: boolean;
    house?: DBIfaHouse;
    house_consultations?: DBConsultation[];
    announcements?: DBAnnouncement[];
    review_records?: DBConsultation[];
    member_role?: string;
  } | null;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!houseData || !houseData.has_house || !houseData.entitled) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-amber-600" />
              {houseData.house?.name || 'Ifa House'}
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                {houseData.member_role}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs">
              {isOpen ? 'Collapse' : 'Expand'}
            </Button>
          </CollapsibleTrigger>
          <CardDescription>House-wide visibility</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* House Consultations */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-amber-600" />
                House-wide Upcoming Consultations
              </h4>
              {(houseData.house_consultations || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming house consultations</p>
              ) : (
                <div className="space-y-2">
                  {(houseData.house_consultations || []).slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-background rounded border">
                      <div>
                        <p className="text-sm font-medium">{c.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getConsultationTypeLabel(c.consultation_type)} • {formatDateTime(c.scheduled_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Announcements */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Megaphone className="h-4 w-4 text-amber-600" />
                House Announcements
              </h4>
              {(houseData.announcements || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No announcements</p>
              ) : (
                <div className="space-y-2">
                  {(houseData.announcements || []).slice(0, 5).map((a) => (
                    <div key={a.id} className="p-2 bg-background rounded border">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(a.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Shared Records Requiring Review */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <FileSearch className="h-4 w-4 text-amber-600" />
                Records Requiring Review
              </h4>
              {(houseData.review_records || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No records pending review</p>
              ) : (
                <div className="space-y-2">
                  {(houseData.review_records || []).slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-background rounded border">
                      <div>
                        <p className="text-sm font-medium">{r.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {getConsultationTypeLabel(r.consultation_type)} • {formatDateTime(r.scheduled_at)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Needs Review</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* House Dashboard Link */}
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => window.location.href = '/awo/house'}
              >
                <Building2 className="h-4 w-4" />
                View Full House Dashboard
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============ MAIN AWO DASHBOARD ============
export default function AwoDashboard() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [consultations, setConsultations] = useState<DBConsultation[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [houseData, setHouseData] = useState<{
    has_house: boolean;
    entitled: boolean;
    house?: DBIfaHouse;
    house_consultations?: DBConsultation[];
    announcements?: DBAnnouncement[];
    review_records?: DBConsultation[];
    member_role?: string;
  } | null>(null);

  const [loadingConsultations, setLoadingConsultations] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [loadingEntitlements, setLoadingEntitlements] = useState(true);
  const [loadingHouse, setLoadingHouse] = useState(true);

  const fetchConsultations = useCallback(async () => {
    setLoadingConsultations(true);
    try {
      const data = await callDashboardAPI('upcoming-consultations');
      setConsultations(data.consultations || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load consultations';
      console.error('Failed to fetch consultations:', message);
    } finally {
      setLoadingConsultations(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await callDashboardAPI('notifications');
      setNotifications(data.notifications || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      console.error('Failed to fetch notifications:', message);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  const fetchEntitlements = useCallback(async () => {
    setLoadingEntitlements(true);
    try {
      const data = await callDashboardAPI('entitlements');
      const allEntitlements = [
        ...(data.user_entitlements || []).map((e: DBSubscriptionEntitlementResponse) => e.entitlement_key),
        ...(data.house_entitlements || []).map((e: DBSubscriptionEntitlementResponse) => e.entitlement_key),
      ];
      setEntitlements(allEntitlements);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load entitlements';
      console.error('Failed to fetch entitlements:', message);
    } finally {
      setLoadingEntitlements(false);
    }
  }, []);

  const fetchHouseVisibility = useCallback(async () => {
    setLoadingHouse(true);
    try {
      const data = await callDashboardAPI('house-visibility');
      setHouseData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load house data';
      console.error('Failed to fetch house visibility:', message);
      setHouseData(null);
    } finally {
      setLoadingHouse(false);
    }
  }, []);

  useEffect(() => {
    if (user && (userRole === 'seller' || userRole === 'admin')) {
      fetchConsultations();
      fetchNotifications();
      fetchEntitlements();
      fetchHouseVisibility();
    }
  }, [user, userRole, fetchConsultations, fetchNotifications, fetchEntitlements, fetchHouseVisibility]);

  const handleReschedule = async (consultationId: string) => {
    // For MVP, show a prompt for new date
    const newDate = prompt('Enter new date/time (YYYY-MM-DD HH:MM):');
    if (!newDate) return;

    try {
      const scheduled = new Date(newDate).toISOString();
      await callDashboardAPI('reschedule', 'PATCH', {
        consultation_id: consultationId,
        new_scheduled_at: scheduled,
      });
      toast.success('Consultation rescheduled');
      fetchConsultations();
    } catch {
      toast.error('Failed to reschedule consultation');
    }
  };

  const handleCancel = async (consultationId: string) => {
    if (!confirm('Are you sure you want to cancel this consultation?')) return;

    try {
      await callDashboardAPI('cancel', 'PATCH', { consultation_id: consultationId });
      toast.success('Consultation cancelled');
      fetchConsultations();
    } catch {
      toast.error('Failed to cancel consultation');
    }
  };

  const handleMarkRead = async (ids: string[]) => {
    try {
      await callDashboardAPI('mark-read', 'PATCH', { notification_ids: ids });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
      );
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleClearAll = async () => {
    try {
      await callDashboardAPI('clear-all', 'PATCH');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  // Access control
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show demo/preview layout for unauthenticated users or non-Awo roles
  const isAuthorized = user && (userRole === 'seller' || userRole === 'admin');

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-heading font-bold">Awo Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {!user
                ? 'Sign in with your Awo account to access your dashboard.'
                : 'The Awo Dashboard is only available to registered practitioners.'}
            </p>
          </div>

          {/* Show the layout structure with auth prompt */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Consultations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">Sign in to view consultations</p>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Play className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common tasks and workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full justify-start h-12 opacity-50" disabled>
                    <Play className="h-5 w-5 mr-3" />
                    Start New Consultation
                  </Button>
                  <Button className="w-full justify-start h-12 opacity-50" variant="outline" disabled>
                    <Calendar className="h-5 w-5 mr-3" />
                    View Today's Schedule
                  </Button>
                  <Button className="w-full justify-start h-12 opacity-50" variant="outline" disabled>
                    <Users className="h-5 w-5 mr-3" />
                    Open Client List
                  </Button>
                  <Button className="w-full justify-start h-12 opacity-50" variant="outline" disabled>
                    <ListChecks className="h-5 w-5 mr-3" />
                    Review Pending Ebo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">Sign in to view notifications</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auth prompt */}
          <div className="mt-8 text-center">
            <Card className="max-w-md mx-auto">
              <CardContent className="py-8">
                <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-bold text-lg mb-2">
                  {!user ? 'Sign In Required' : 'Awo Access Required'}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {!user
                    ? 'Please sign in with your Awo practitioner account.'
                    : 'Contact admin to upgrade your account to Awo practitioner status.'}
                </p>
                <Button onClick={() => navigate(!user ? '/auth' : '/')}>
                  {!user ? 'Sign In' : 'Return Home'}
                </Button>
              </CardContent>
            </Card>
          </div>
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
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">Awo Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back. Here's your daily workflow overview.
          </p>
        </div>

        {/* Three-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Upcoming Consultations */}
          <UpcomingConsultationsPanel
            consultations={consultations}
            loading={loadingConsultations}
            onReschedule={handleReschedule}
            onCancel={handleCancel}
            onRefresh={fetchConsultations}
          />

          {/* Column 2: Quick Actions */}
          <QuickActionsPanel
            entitlements={entitlements}
            loading={loadingEntitlements}
          />

          {/* Column 3: Notifications */}
          <NotificationsPanel
            notifications={notifications}
            loading={loadingNotifications}
            onMarkRead={handleMarkRead}
            onClearAll={handleClearAll}
            onRefresh={fetchNotifications}
          />
        </div>

        {/* Fourth Panel: House-Level Visibility (collapsible) */}
        <div className="mt-6">
          <HouseVisibilityPanel
            houseData={houseData}
            loading={loadingHouse}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Type for entitlement response
interface DBSubscriptionEntitlementResponse {
  entitlement_key: string;
  is_active: boolean;
}