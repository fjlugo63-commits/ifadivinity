import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Server, Flag, CreditCard, Users, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminSettings() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
      <p className="text-sm text-gray-500">Phase 1 — View only. Write actions available in Phase 2.</p>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            Developer Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/system/test-accounts')}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            System Test Accounts
            <ExternalLink className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/setup/super-admin')}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Super Admin Setup
            <ExternalLink className="w-3 h-3" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-500" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Mode</span>
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                Test
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Database</span>
              <span className="text-sm font-medium">Supabase (PostgreSQL)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Auth Provider</span>
              <span className="text-sm font-medium">Supabase Auth</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Payment Provider</span>
              <span className="text-sm font-medium">Stripe (Test Mode)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Edge Functions</span>
              <span className="text-sm font-medium">Supabase Edge Functions</span>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-500" />
              Subscription Plans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium">Free Tier</p>
                <p className="text-xs text-gray-500">Basic access, 1 consultation/month</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium">Awo Basic</p>
                <p className="text-xs text-gray-500">Up to 10 clients, scheduling</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium">Awo Pro</p>
                <p className="text-xs text-gray-500">Unlimited clients, house access</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="text-sm font-medium">House Plan</p>
                <p className="text-xs text-gray-500">Multi-practitioner, announcements</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-gray-500" />
              Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm">Client Portal</span>
              <Badge variant="default" className="bg-green-100 text-green-700">Enabled</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm">Awo Dashboard</span>
              <Badge variant="default" className="bg-green-100 text-green-700">Enabled</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm">Botanica Marketplace</span>
              <Badge variant="default" className="bg-green-100 text-green-700">Enabled</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm">Messaging</span>
              <Badge variant="default" className="bg-green-100 text-green-700">Enabled</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm">Smart Opele Integration</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm">Video Consultations</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              System Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Version</span>
              <span className="text-sm font-medium">1.0.0 (MVP)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Last Deploy</span>
              <span className="text-sm font-medium">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">RLS Policies</span>
              <span className="text-sm font-medium">Active on all tables</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Edge Functions</span>
              <span className="text-sm font-medium">12 deployed</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}