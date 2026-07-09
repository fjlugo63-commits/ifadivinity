import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Calendar } from 'lucide-react';
import { supabase, TABLES } from '@/lib/supabase';
import { toast } from 'sonner';

interface ConsultationRow {
  id: string;
  awo_id: string;
  client_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  awo_name?: string;
  client_name?: string;
  payment_status?: string;
  ebo_status?: string;
}

export default function AdminConsultations() {
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailData, setDetailData] = useState<{
    odu?: { name: string; category: string } | null;
    outcome?: { outcome_type: string; sub_type: string } | null;
    ebo?: { category: string; status: string } | null;
    summary?: { summary_text: string } | null;
  }>({});

  useEffect(() => {
    fetchConsultations();
  }, []);

  async function fetchConsultations() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.consultations)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with names
      const allAwoIds = [...new Set((data || []).map((c) => c.awo_id).filter(Boolean))];
      const allClientIds = [...new Set((data || []).map((c) => c.client_id).filter(Boolean))];

      const [awosRes, clientsRes] = await Promise.all([
        allAwoIds.length > 0
          ? supabase.from(TABLES.profiles).select('id, full_name, email').in('id', allAwoIds)
          : { data: [] },
        allClientIds.length > 0
          ? supabase.from(TABLES.clients).select('id, name').in('id', allClientIds)
          : { data: [] },
      ]);

      const awoMap: Record<string, string> = {};
      (awosRes.data || []).forEach((a) => {
        awoMap[a.id] = a.full_name || a.email?.split('@')[0] || 'Unknown';
      });

      const clientMap: Record<string, string> = {};
      (clientsRes.data || []).forEach((c) => {
        clientMap[c.id] = c.name || 'Unknown';
      });

      const enriched: ConsultationRow[] = (data || []).map((c) => ({
        ...c,
        awo_name: awoMap[c.awo_id] || 'Unknown',
        client_name: clientMap[c.client_id] || 'Unknown',
      }));

      setConsultations(enriched);
    } catch (err) {
      console.error('Error fetching consultations:', err);
      toast.error('Failed to load consultations');
    } finally {
      setLoading(false);
    }
  }

  async function viewDetail(consultation: ConsultationRow) {
    setSelectedConsultation(consultation);
    setShowDetail(true);

    // Fetch related detail data (safe metadata only)
    const [oduRes, outcomeRes, eboRes, summaryRes] = await Promise.all([
      supabase.from(TABLES.consultation_odu).select('odu_id').eq('consultation_id', consultation.id).limit(1),
      supabase.from(TABLES.ire_osogbo).select('outcome_type, sub_type').eq('consultation_id', consultation.id).limit(1),
      supabase.from(TABLES.ebo).select('category, status').eq('consultation_id', consultation.id).limit(1),
      supabase.from(TABLES.consultation_summary).select('summary_text').eq('consultation_id', consultation.id).limit(1),
    ]);

    let oduInfo = null;
    if (oduRes.data && oduRes.data.length > 0) {
      const { data: oduRef } = await supabase
        .from(TABLES.odu_reference)
        .select('name, category')
        .eq('id', oduRes.data[0].odu_id)
        .single();
      oduInfo = oduRef;
    }

    setDetailData({
      odu: oduInfo,
      outcome: outcomeRes.data?.[0] || null,
      ebo: eboRes.data?.[0] || null,
      summary: summaryRes.data?.[0] || null,
    });
  }

  const filteredConsultations = consultations.filter((c) => {
    const matchesSearch =
      (c.awo_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (showDetail && selectedConsultation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Consultation Detail</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Awo</span>
                <span className="text-sm font-medium">{selectedConsultation.awo_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Client</span>
                <span className="text-sm font-medium">{selectedConsultation.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={selectedConsultation.status === 'completed' ? 'default' : 'secondary'}>
                  {selectedConsultation.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium">
                  {new Date(selectedConsultation.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Updated</span>
                <span className="text-sm font-medium">
                  {new Date(selectedConsultation.updated_at).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Odu</span>
                <span className="text-sm font-medium">
                  {detailData.odu ? `${detailData.odu.name} (${detailData.odu.category})` : 'Not recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Outcome</span>
                <span className="text-sm font-medium">
                  {detailData.outcome
                    ? `${detailData.outcome.outcome_type} - ${detailData.outcome.sub_type}`
                    : 'Not recorded'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Ebo</span>
                <span className="text-sm font-medium">
                  {detailData.ebo ? `${detailData.ebo.category} (${detailData.ebo.status})` : 'Not prescribed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Summary</span>
                <span className="text-sm font-medium">
                  {detailData.summary ? 'Available' : 'Not generated'}
                </span>
              </div>
              <p className="text-xs text-gray-400 italic pt-2 border-t">
                Note: Awo-only notes and internal Odu mechanics are not exposed in the Admin view.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Consultations Management</h1>
        <Badge variant="outline">{consultations.length} total</Badge>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by Awo or Client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredConsultations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No consultations found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Awo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredConsultations.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{c.awo_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.client_name}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            c.status === 'completed'
                              ? 'default'
                              : c.status === 'cancelled'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => viewDetail(c)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}