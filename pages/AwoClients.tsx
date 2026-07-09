import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { DBClient, DBClientNote, DBConsultation } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Search,
  Plus,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Calendar,
  FileText,
  Clock,
  Edit,
  UserCheck,
  UserX,
  MessageSquare,
  PlayCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_awo_clients`;

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Tokyo',
  'Australia/Sydney',
];

interface ClientConsultation extends DBConsultation {
  odu_name?: string | null;
  outcome_type?: string | null;
  outcome_subtype?: string | null;
  ebo_category?: string | null;
  ebo_status?: string | null;
}

export default function AwoClients() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [clients, setClients] = useState<DBClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'upcoming'>('all');
  const [totalClients, setTotalClients] = useState(0);
  const [page, setPage] = useState(1);

  // Selected client state
  const [selectedClient, setSelectedClient] = useState<DBClient | null>(null);
  const [clientConsultations, setClientConsultations] = useState<ClientConsultation[]>([]);
  const [clientNotes, setClientNotes] = useState<DBClientNote[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', timezone: 'America/New_York' });
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        action: 'list',
        search: searchQuery,
        filter,
        page: page.toString(),
        limit: '20',
      });

      const res = await fetch(`${EDGE_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data.clients || []);
      setTotalClients(data.total || 0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filter, page, toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const fetchClientDetail = async (client: DBClient) => {
    setSelectedClient(client);
    setLoadingDetail(true);
    try {
      const token = await getToken();

      // Fetch consultations
      const consRes = await fetch(
        `${EDGE_URL}?action=client-consultations&client_id=${client.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (consRes.ok) {
        const consData = await consRes.json();
        setClientConsultations(consData.consultations || []);
      }

      // Fetch notes
      const notesRes = await fetch(
        `${EDGE_URL}?action=get-notes&client_id=${client.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setClientNotes(notesData.notes || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddClient = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${EDGE_URL}?action=create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create client');
      }

      toast({ title: 'Success', description: 'Client added successfully' });
      setShowAddDialog(false);
      setFormData({ name: '', email: '', phone: '', timezone: 'America/New_York' });
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClient = async () => {
    if (!selectedClient || !formData.name.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${EDGE_URL}?action=update`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: selectedClient.id, ...formData }),
      });

      if (!res.ok) throw new Error('Failed to update client');

      const data = await res.json();
      setSelectedClient(data.client);
      toast({ title: 'Success', description: 'Client updated successfully' });
      setShowEditDialog(false);
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (client: DBClient) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      const token = await getToken();
      const res = await fetch(`${EDGE_URL}?action=update`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: client.id, status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast({ title: 'Success', description: `Client marked as ${newStatus}` });
      if (selectedClient?.id === client.id) {
        setSelectedClient({ ...selectedClient, status: newStatus });
      }
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedClient || !noteContent.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${EDGE_URL}?action=save-note`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: selectedClient.id,
          content: noteContent,
        }),
      });

      if (!res.ok) throw new Error('Failed to save note');

      const data = await res.json();
      setClientNotes([data.note, ...clientNotes]);
      setNoteContent('');
      setShowNoteDialog(false);
      toast({ title: 'Success', description: 'Note saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStartConsultation = async (client: DBClient) => {
    try {
      const token = await getToken();
      const res = await fetch(`${EDGE_URL}?action=start-consultation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_id: client.id }),
      });

      if (!res.ok) throw new Error('Failed to start consultation');

      const data = await res.json();
      navigate(`/consultation/${data.consultation.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Client List View
  const renderClientList = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Client Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalClients} client{totalClients !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          onClick={() => {
            setFormData({ name: '', email: '', phone: '', timezone: 'America/New_York' });
            setShowAddDialog(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="upcoming">Has Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No clients found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first client to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
              style={{ borderLeftColor: client.status === 'active' ? '#4F46E5' : '#9CA3AF' }}
              onClick={() => fetchClientDetail(client)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 font-semibold text-sm">
                        {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{client.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="text-sm">
                      <p className="text-gray-600">
                        {client.total_consultations || 0} consultation{(client.total_consultations || 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Last: {formatDate(client.last_consultation_date || null)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.has_upcoming && (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          Upcoming
                        </Badge>
                      )}
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                        {client.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalClients > 20 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-500">
            Page {page} of {Math.ceil(totalClients / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(totalClients / 20)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );

  // Client Detail View
  const renderClientDetail = () => {
    if (!selectedClient) return null;

    return (
      <div className="space-y-4">
        {/* Back button + Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedClient(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleStatus(selectedClient)}
            >
              {selectedClient.status === 'active' ? (
                <><UserX className="h-4 w-4 mr-1" /> Mark Inactive</>
              ) : (
                <><UserCheck className="h-4 w-4 mr-1" /> Mark Active</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFormData({
                  name: selectedClient.name,
                  email: selectedClient.email || '',
                  phone: selectedClient.phone || '',
                  timezone: selectedClient.timezone,
                });
                setShowEditDialog(true);
              }}
            >
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => handleStartConsultation(selectedClient)}
            >
              <PlayCircle className="h-4 w-4 mr-1" /> New Consultation
            </Button>
          </div>
        </div>

        {/* Client Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-700 font-bold text-xl">
                  {selectedClient.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{selectedClient.name}</h2>
                  <Badge variant={selectedClient.status === 'active' ? 'default' : 'secondary'}>
                    {selectedClient.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedClient.email}
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedClient.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="h-4 w-4 text-gray-400" />
                    {selectedClient.timezone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    Client since {formatDate(selectedClient.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Consultations & Notes */}
        {loadingDetail ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <Tabs defaultValue="consultations">
            <TabsList>
              <TabsTrigger value="consultations" className="gap-1">
                <Clock className="h-4 w-4" />
                Consultations ({clientConsultations.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1">
                <FileText className="h-4 w-4" />
                Notes ({clientNotes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="consultations" className="mt-4">
              {clientConsultations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No consultations yet</p>
                    <Button
                      className="mt-3 bg-indigo-600 hover:bg-indigo-700"
                      size="sm"
                      onClick={() => handleStartConsultation(selectedClient)}
                    >
                      Start First Consultation
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {clientConsultations.map((consultation) => (
                    <Card
                      key={consultation.id}
                      className="cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate(`/consultation/${consultation.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${
                              consultation.status === 'completed' ? 'bg-green-500' :
                              consultation.status === 'active' ? 'bg-blue-500' :
                              consultation.status === 'scheduled' ? 'bg-amber-500' :
                              'bg-gray-400'
                            }`} />
                            <div>
                              <p className="font-medium text-gray-900">
                                {formatDateTime(consultation.scheduled_at)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {consultation.odu_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {consultation.odu_name}
                                  </Badge>
                                )}
                                {consultation.outcome_type && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      consultation.outcome_type === 'ire'
                                        ? 'text-emerald-600 border-emerald-200'
                                        : 'text-red-600 border-red-200'
                                    }`}
                                  >
                                    {consultation.outcome_type}
                                    {consultation.outcome_subtype && ` - ${consultation.outcome_subtype}`}
                                  </Badge>
                                )}
                                {consultation.ebo_category && (
                                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                                    Ebo: {consultation.ebo_category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant={
                            consultation.status === 'completed' ? 'default' :
                            consultation.status === 'active' ? 'secondary' :
                            'outline'
                          }>
                            {consultation.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNoteContent('');
                    setShowNoteDialog(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </div>
              {clientNotes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No notes yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {clientNotes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <p className="text-gray-700 whitespace-pre-wrap flex-1">{note.content}</p>
                          <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                            {formatDate(note.created_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Navigation breadcrumb */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/awo/dashboard')} className="text-gray-500">
            ← Back to Dashboard
          </Button>
        </div>

        {selectedClient ? renderClientDetail() : renderClientList()}
      </div>

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Client's full name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(v) => setFormData({ ...formData, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddClient} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Adding...' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(v) => setFormData({ ...formData, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateClient} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note for {selectedClient?.name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="note-content">Note</Label>
            <Textarea
              id="note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note about this client..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={saving || !noteContent.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}