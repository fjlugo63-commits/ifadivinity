import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Search, UserCheck, ToggleLeft, ToggleRight, Home } from 'lucide-react';
import { supabase, TABLES, DBProfile } from '@/lib/supabase';
import { toast } from 'sonner';

interface AwoDetail extends DBProfile {
  house_name?: string;
  total_consultations?: number;
  total_clients?: number;
}

export default function AdminAwos() {
  const [awos, setAwos] = useState<AwoDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAwo, setSelectedAwo] = useState<AwoDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [houses, setHouses] = useState<{ id: string; name: string }[]>([]);
  const [assignHouseDialog, setAssignHouseDialog] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState('');

  useEffect(() => {
    fetchAwos();
    fetchHouses();
  }, []);

  async function fetchAwos() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .eq('role', 'awo')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with consultation counts
      const enriched: AwoDetail[] = await Promise.all(
        (data || []).map(async (awo) => {
          const [consultRes, clientsRes, houseRes] = await Promise.all([
            supabase.from(TABLES.consultations).select('id', { count: 'exact', head: true }).eq('awo_id', awo.id),
            supabase.from(TABLES.clients).select('id', { count: 'exact', head: true }).eq('awo_id', awo.id),
            supabase.from(TABLES.house_practitioners).select('house_id').eq('practitioner_id', awo.id).limit(1),
          ]);

          let houseName = '';
          if (houseRes.data && houseRes.data.length > 0) {
            const { data: houseData } = await supabase
              .from(TABLES.ifa_houses)
              .select('name')
              .eq('id', houseRes.data[0].house_id)
              .single();
            houseName = houseData?.name || '';
          }

          return {
            ...awo,
            total_consultations: consultRes.count || 0,
            total_clients: clientsRes.count || 0,
            house_name: houseName,
          };
        })
      );

      setAwos(enriched);
    } catch (err) {
      console.error('Error fetching awos:', err);
      toast.error('Failed to load Awos');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHouses() {
    const { data } = await supabase.from(TABLES.ifa_houses).select('id, name').order('name');
    setHouses(data || []);
  }

  async function toggleAwoStatus(awo: AwoDetail) {
    const newStatus = awo.verified_egbo ? false : true;
    const { error } = await supabase
      .from(TABLES.profiles)
      .update({ verified_egbo: newStatus })
      .eq('id', awo.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success(`Awo ${newStatus ? 'activated' : 'deactivated'}`);
    setAwos((prev) => prev.map((a) => (a.id === awo.id ? { ...a, verified_egbo: newStatus } : a)));
    if (selectedAwo?.id === awo.id) {
      setSelectedAwo({ ...selectedAwo, verified_egbo: newStatus });
    }
  }

  async function assignHouse() {
    if (!selectedAwo || !selectedHouse) return;

    // Remove from current house
    await supabase
      .from(TABLES.house_practitioners)
      .delete()
      .eq('practitioner_id', selectedAwo.id);

    if (selectedHouse !== 'none') {
      const { error } = await supabase.from(TABLES.house_practitioners).insert({
        house_id: selectedHouse,
        practitioner_id: selectedAwo.id,
        role: 'member',
      });

      if (error) {
        toast.error('Failed to assign house');
        return;
      }
    }

    const houseName = selectedHouse === 'none' ? '' : houses.find((h) => h.id === selectedHouse)?.name || '';
    toast.success(selectedHouse === 'none' ? 'Unassigned from house' : `Assigned to ${houseName}`);
    setAssignHouseDialog(false);
    setSelectedHouse('');
    setAwos((prev) =>
      prev.map((a) => (a.id === selectedAwo.id ? { ...a, house_name: houseName } : a))
    );
    if (selectedAwo) {
      setSelectedAwo({ ...selectedAwo, house_name: houseName });
    }
  }

  const filteredAwos = awos.filter(
    (a) =>
      (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (showDetail && selectedAwo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Awo Detail</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-medium">{selectedAwo.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium">{selectedAwo.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">House</span>
                <span className="text-sm font-medium">{selectedAwo.house_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge variant={selectedAwo.verified_egbo ? 'default' : 'secondary'}>
                  {selectedAwo.verified_egbo ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Consultations</span>
                <span className="text-sm font-medium">{selectedAwo.total_consultations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Clients</span>
                <span className="text-sm font-medium">{selectedAwo.total_clients}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Joined</span>
                <span className="text-sm font-medium">
                  {new Date(selectedAwo.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  variant={selectedAwo.verified_egbo ? 'destructive' : 'default'}
                  onClick={() => toggleAwoStatus(selectedAwo)}
                >
                  {selectedAwo.verified_egbo ? (
                    <><ToggleLeft className="w-4 h-4 mr-1" /> Deactivate</>
                  ) : (
                    <><ToggleRight className="w-4 h-4 mr-1" /> Activate</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedHouse('');
                    setAssignHouseDialog(true);
                  }}
                >
                  <Home className="w-4 h-4 mr-1" /> Assign House
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                {selectedAwo.total_consultations} total consultations, {selectedAwo.total_clients} clients managed.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Assign House Dialog */}
        <Dialog open={assignHouseDialog} onOpenChange={setAssignHouseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign House</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedHouse} onValueChange={setSelectedHouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a house..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassign (No House)</SelectItem>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignHouseDialog(false)}>Cancel</Button>
                <Button onClick={assignHouse}>Confirm</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Awos Management</h1>
        <Badge variant="outline">{awos.length} total</Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredAwos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No Awos found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">House</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Consultations</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Clients</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAwos.map((awo) => (
                    <tr key={awo.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{awo.full_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{awo.email || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{awo.house_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={awo.verified_egbo ? 'default' : 'secondary'}>
                          {awo.verified_egbo ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{awo.total_consultations}</td>
                      <td className="px-4 py-3 text-gray-600">{awo.total_clients}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAwo(awo);
                            setShowDetail(true);
                          }}
                        >
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