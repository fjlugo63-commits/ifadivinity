import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, ArrowRight } from 'lucide-react';

interface Consultation {
  id: string;
  client_name: string;
  status: string;
  scheduled_at: string;
  type: string;
  notes?: string;
}

export default function AwoConsultations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchConsultations();
  }, [user]);

  async function fetchConsultations() {
    try {
      const { data, error } = await supabase
        .from(TABLES.consultations)
        .select('*')
        .eq('awo_id', user?.id)
        .order('scheduled_at', { ascending: false });

      if (!error && data) {
        setConsultations(data as Consultation[]);
      }
    } catch (err) {
      console.error('Error fetching consultations:', err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
        <Badge variant="outline" className="text-sm">
          {consultations.length} total
        </Badge>
      </div>

      {consultations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Consultations Yet</h3>
            <p className="text-gray-500">Your assigned consultations will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {consultations.map((consultation) => (
            <Card key={consultation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{consultation.client_name || 'Client'}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {consultation.scheduled_at
                            ? new Date(consultation.scheduled_at).toLocaleDateString()
                            : 'Not scheduled'}
                        </span>
                        {consultation.type && (
                          <Badge variant="secondary" className="text-xs">
                            {consultation.type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(consultation.status)}>
                      {consultation.status?.replace('_', ' ') || 'pending'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/consultation/${consultation.id}`)}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}