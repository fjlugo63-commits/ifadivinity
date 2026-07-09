import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  Clock,
  User,
  BookOpen,
  Sun,
  CloudLightning,
  FileText,
  ClipboardList,
  Copy,
  Send,
  Filter,
  ChevronRight,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, DBConsultation, DBConsultationOdu, DBIreOsogbo, DBEbo, DBConsultationNote, DBConsultationSummary } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ConsultationDetails {
  consultation: DBConsultation;
  odu: DBConsultationOdu | null;
  outcome: DBIreOsogbo | null;
  ebo: DBEbo | null;
  notes: DBConsultationNote | null;
  summary: DBConsultationSummary | null;
}

async function callHistoryAPI(action: string, params?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const searchParams = new URLSearchParams({ action, ...params });
  const url = `${supabaseUrl}/functions/v1/app_consultation_history?${searchParams.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

// Binary pattern visual component (reused from ConsultationWorkspace)
function BinaryPatternDisplay({ pattern, size = 'sm' }: { pattern: string; size?: 'sm' | 'md' }) {
  const sizeClasses = { sm: 'w-2 h-2', md: 'w-3 h-3' };
  const rightLeg = pattern.slice(0, 4);
  const leftLeg = pattern.slice(4, 8);

  return (
    <div className="flex gap-2 items-center">
      <div className="flex flex-col gap-0.5 items-center">
        {rightLeg.split('').map((bit, i) => (
          <div key={`r-${i}`} className="flex gap-0.5">
            {bit === '1' ? (
              <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
            ) : (
              <>
                <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
                <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 items-center">
        {leftLeg.split('').map((bit, i) => (
          <div key={`l-${i}`} className="flex gap-0.5">
            {bit === '1' ? (
              <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
            ) : (
              <>
                <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
                <div className={`${sizeClasses[size]} rounded-full bg-primary`} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConsultationHistory() {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // List state
  const [consultations, setConsultations] = useState<DBConsultation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [oduFilter, setOduFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsultationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState('odu');

  // Check for client_id filter from URL
  const clientIdParam = searchParams.get('client_id');

  // Fetch consultation list
  const fetchHistory = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: Record<string, string> = { page: page.toString(), limit: '20' };
      if (searchQuery) params.search = searchQuery;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (oduFilter) params.odu = oduFilter;
      if (outcomeFilter && outcomeFilter !== 'all') params.outcome = outcomeFilter;
      if (clientIdParam) params.client_id = clientIdParam;

      const data = await callHistoryAPI('history', params);
      setConsultations(data.consultations || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      toast.error(message);
    } finally {
      setLoadingList(false);
    }
  }, [page, searchQuery, dateFrom, dateTo, oduFilter, outcomeFilter, clientIdParam]);

  // Fetch consultation details
  const fetchDetails = useCallback(async (consultationId: string) => {
    setLoadingDetails(true);
    try {
      const data = await callHistoryAPI('details', { consultation_id: consultationId });
      setDetails(data);
      setDetailTab('odu');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load details';
      toast.error(message);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (user && (userRole === 'seller' || userRole === 'admin')) {
      fetchHistory();
    }
  }, [user, userRole, fetchHistory]);

  const handleSelectConsultation = (id: string) => {
    setSelectedId(id);
    fetchDetails(id);
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  const copySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  };

  // Access control
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-2" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isAuthorized = user && (userRole === 'seller' || userRole === 'admin');
  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          <Card className="max-w-md mx-auto mt-12">
            <CardContent className="py-8 text-center">
              <History className="h-12 w-12 mx-auto text-amber-500 mb-3" />
              <h3 className="font-bold text-lg mb-2">Access Denied</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Consultation History is only available to Awo practitioners.
              </p>
              <Button onClick={() => navigate('/awo/dashboard')}>
                Return to Dashboard
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
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/awo/dashboard')} className="h-7 px-2">
              ← Dashboard
            </Button>
            <span>/</span>
            <span>Consultation History</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                Consultation History
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                View all past consultations with full details
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {total} consultation{total !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT PANEL: Consultation List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by client name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>

              {/* Advanced Filters */}
              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <CollapsibleContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">From</label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">To</label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Input
                    placeholder="Filter by Odu name..."
                    value={oduFilter}
                    onChange={(e) => setOduFilter(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Outcome filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outcomes</SelectItem>
                      <SelectItem value="ire">Ire (Blessings)</SelectItem>
                      <SelectItem value="osogbo">Osogbo (Challenges)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSearch} className="w-full h-8 text-xs">
                    Apply Filters
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Consultation List */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              {loadingList ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">No past consultations found</p>
                  {(searchQuery || oduFilter || outcomeFilter !== 'all' || dateFrom || dateTo) && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setSearchQuery('');
                        setOduFilter('');
                        setOutcomeFilter('all');
                        setDateFrom('');
                        setDateTo('');
                        setPage(1);
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {consultations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConsultation(c.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
                        selectedId === c.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium text-sm truncate">{c.client_name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.scheduled_at).toLocaleDateString()}
                            </span>
                            <Clock className="h-3 w-3 text-muted-foreground ml-1" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={c.status === 'completed' ? 'default' : 'destructive'}
                              className="text-[10px] h-4"
                            >
                              {c.status === 'completed' ? (
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <XCircle className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              {c.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {c.consultation_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${
                          selectedId === c.id ? 'text-primary' : ''
                        }`} />
                      </div>
                    </button>
                  ))}

                  {/* Pagination */}
                  {total > 20 && (
                    <div className="flex items-center justify-between pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="h-7 text-xs"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {page} of {Math.ceil(total / 20)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page * 20 >= total}
                        onClick={() => setPage(p => p + 1)}
                        className="h-7 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* RIGHT PANEL: Consultation Detail View */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <Card className="h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium text-lg text-muted-foreground mb-2">
                    Select a Consultation
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Choose a consultation from the list to view its full details including Odu, Ire/Osogbo, Ebo, Notes, and Summary.
                  </p>
                </CardContent>
              </Card>
            ) : loadingDetails ? (
              <Card>
                <CardContent className="py-8 space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ) : details ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        {details.consultation.client_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(details.consultation.scheduled_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(details.consultation.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Badge variant={details.consultation.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
                          {details.consultation.status}
                        </Badge>
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/consultation/${details.consultation.id}`)}
                      className="text-xs"
                    >
                      Open Workspace
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={detailTab} onValueChange={setDetailTab}>
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="odu" className="text-xs">
                        <BookOpen className="h-3 w-3 mr-1" />
                        Odu
                      </TabsTrigger>
                      <TabsTrigger value="outcome" className="text-xs">
                        <Sun className="h-3 w-3 mr-1" />
                        Outcome
                      </TabsTrigger>
                      <TabsTrigger value="ebo" className="text-xs">
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Ebo
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        Notes
                      </TabsTrigger>
                      <TabsTrigger value="summary" className="text-xs">
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Summary
                      </TabsTrigger>
                    </TabsList>

                    {/* Odu Tab */}
                    <TabsContent value="odu" className="mt-4">
                      {details.odu?.odu ? (
                        <div className="space-y-4">
                          <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <BinaryPatternDisplay pattern={details.odu.odu.binary_pattern} size="md" />
                            <div className="flex-1">
                              <h3 className="text-xl font-bold">{details.odu.odu.name}</h3>
                              {details.odu.odu.aliases && details.odu.odu.aliases.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  Also known as: {details.odu.odu.aliases.join(', ')}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={details.odu.odu.category === 'major' ? 'default' : 'outline'}>
                                  {details.odu.odu.category === 'major' ? 'Major Odu' : 'Minor Odu'}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  Pattern: {details.odu.odu.binary_pattern}
                                </span>
                              </div>
                              {details.odu.odu.description && (
                                <p className="text-sm text-muted-foreground mt-3">{details.odu.odu.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Confirmed: {new Date(details.odu.confirmed_at).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No Odu was recorded for this consultation</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Outcome Tab */}
                    <TabsContent value="outcome" className="mt-4">
                      {details.outcome ? (
                        <div className="space-y-4">
                          <div className={`p-4 rounded-lg border ${
                            details.outcome.outcome_type === 'ire'
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-3 rounded-full ${
                                details.outcome.outcome_type === 'ire' ? 'bg-emerald-200' : 'bg-red-200'
                              }`}>
                                {details.outcome.outcome_type === 'ire' ? (
                                  <Sun className="h-6 w-6 text-emerald-700" />
                                ) : (
                                  <CloudLightning className="h-6 w-6 text-red-700" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-bold text-lg">
                                  {details.outcome.outcome_type === 'ire' ? 'Ire (Blessing)' : 'Osogbo (Misfortune)'}
                                </h3>
                                <p className={`text-sm ${
                                  details.outcome.outcome_type === 'ire' ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                  {details.outcome.outcome_subtype.replace(/_/g, ' ')}
                                </p>
                              </div>
                              <Badge
                                variant={details.outcome.outcome_type === 'ire' ? 'default' : 'destructive'}
                                className="ml-auto"
                              >
                                {details.outcome.outcome_type === 'ire' ? 'Blessing' : 'Misfortune'}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Confirmed: {new Date(details.outcome.confirmed_at).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Sun className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No Ire/Osogbo outcome was recorded</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Ebo Tab */}
                    <TabsContent value="ebo" className="mt-4">
                      {details.ebo ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border bg-amber-50/50 border-amber-200">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold">Ebo Prescription</h3>
                              <Badge variant={
                                details.ebo.status === 'completed' ? 'default' :
                                details.ebo.status === 'in_progress' ? 'secondary' :
                                details.ebo.status === 'cancelled' ? 'destructive' : 'outline'
                              }>
                                {details.ebo.status.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Category:</span>
                                <p className="text-sm font-medium">{details.ebo.ebo_category}</p>
                              </div>
                              {details.ebo.ebo_items && details.ebo.ebo_items.length > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Items:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {details.ebo.ebo_items.map((item, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {item}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {details.ebo.instructions && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Instructions:</span>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{details.ebo.instructions}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Confirmed: {new Date(details.ebo.confirmed_at).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No Ebo was prescribed for this consultation</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Notes Tab */}
                    <TabsContent value="notes" className="mt-4">
                      {details.notes ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg border bg-muted/20">
                            <div className="whitespace-pre-wrap text-sm">{details.notes.content}</div>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>Created: {new Date(details.notes.created_at).toLocaleString()}</span>
                            <span>Updated: {new Date(details.notes.updated_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No notes were recorded for this consultation</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Summary Tab */}
                    <TabsContent value="summary" className="mt-4">
                      {details.summary ? (
                        <div className="space-y-4">
                          {/* Full Summary */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium">Full Summary</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => copySummary(details.summary!.summary_text)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <div className="p-4 rounded-lg border bg-muted/20 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                              {details.summary.summary_text}
                            </div>
                          </div>

                          <Separator />

                          {/* Client Summary */}
                          {details.summary.client_summary && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" />
                                  Client Version
                                </h4>
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => copySummary(details.summary!.client_summary!)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Send
                                  </Button>
                                </div>
                              </div>
                              <div className="p-4 rounded-lg border border-blue-100 bg-blue-50 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                {details.summary.client_summary}
                              </div>
                            </div>
                          )}

                          {/* Confirmation status */}
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            {details.summary.confirmed_at ? (
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Confirmed: {new Date(details.summary.confirmed_at).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-amber-600">Not yet confirmed</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No summary was generated for this consultation</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}