import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured, TABLES } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Edit3,
  Save,
  X,
  LogOut,
  Shield,
  Send,
  Trash2,
  ArrowLeft,
  Check,
} from 'lucide-react';

// Supported timezones
const SUPPORTED_TIMEZONES = [
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
  'Europe/Moscow',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
];

interface ClientProfileData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  status: string;
  created_at: string;
}

// Mock data for when Supabase isn't connected
const MOCK_PROFILE: ClientProfileData = {
  id: 'mock-client-1',
  name: 'Adunni Okafor',
  email: 'adunni@example.com',
  phone: '+1 (555) 123-4567',
  timezone: 'America/New_York',
  status: 'active',
  created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
};

export default function ClientProfile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showEmailChange, setShowEmailChange] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !user) {
        setProfile(MOCK_PROFILE);
        setLoading(false);
        return;
      }

      // Try to find client record by auth user email
      const { data: clientData, error } = await supabase
        .from(TABLES.clients)
        .select('*')
        .eq('email', user.email)
        .eq('status', 'active')
        .single();

      if (error || !clientData) {
        // Fallback: try by profiles table link
        const { data: profileData } = await supabase
          .from(TABLES.profiles)
          .select('id, email, name')
          .eq('id', user.id)
          .single();

        if (profileData) {
          const { data: clientByProfile } = await supabase
            .from(TABLES.clients)
            .select('*')
            .eq('email', profileData.email)
            .eq('status', 'active')
            .single();

          if (clientByProfile) {
            setProfile(clientByProfile);
          } else {
            // Create a synthetic profile from auth data
            setProfile({
              id: user.id,
              name: profileData.name || user.email?.split('@')[0] || 'Client',
              email: user.email || null,
              phone: null,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
              status: 'active',
              created_at: user.created_at || new Date().toISOString(),
            });
          }
        } else {
          setProfile(MOCK_PROFILE);
        }
      } else {
        setProfile(clientData);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfile(MOCK_PROFILE);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone || '');
    setEditTimezone(profile.timezone);
    setEditEmail(profile.email || '');
    setShowEmailChange(false);
    setErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setErrors({});
    setShowEmailChange(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editName.trim()) {
      newErrors.name = 'Name is required';
    }

    if (editPhone && !/^[+]?[\d\s\-().]{7,20}$/.test(editPhone)) {
      newErrors.phone = 'Invalid phone format';
    }

    if (!editTimezone) {
      newErrors.timezone = 'Timezone is required';
    }

    if (showEmailChange && editEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
        newErrors.email = 'Invalid email format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateForm() || !profile) return;

    setSaving(true);
    try {
      if (!isSupabaseConfigured || !user) {
        // Mock save
        setProfile({
          ...profile,
          name: editName,
          phone: editPhone || null,
          timezone: editTimezone,
        });
        toast.success('Profile updated successfully');
        setIsEditing(false);
        setSaving(false);
        return;
      }

      const updates: Record<string, string | null> = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        timezone: editTimezone,
      };

      const { error } = await supabase
        .from(TABLES.clients)
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        toast.error('Failed to update profile: ' + error.message);
        return;
      }

      setProfile({
        ...profile,
        ...updates,
        phone: updates.phone,
      });

      // If timezone changed, notify
      if (editTimezone !== profile.timezone) {
        toast.success('Timezone updated — all times will now display in ' + formatTimezone(editTimezone));
      } else {
        toast.success('Profile updated successfully');
      }

      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const initiateEmailChange = async () => {
    if (!editEmail || !profile) return;

    if (editEmail === profile.email) {
      toast.info('This is already your current email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      setErrors({ ...errors, email: 'Invalid email format' });
      return;
    }

    setSaving(true);
    try {
      if (!isSupabaseConfigured || !user) {
        toast.success('Email change initiated — check your new email for a confirmation link');
        setShowEmailChange(false);
        setSaving(false);
        return;
      }

      // Check if email is already in use
      const { data: existing } = await supabase
        .from(TABLES.clients)
        .select('id')
        .eq('email', editEmail)
        .neq('id', profile.id)
        .single();

      if (existing) {
        setErrors({ ...errors, email: 'Email already in use' });
        setSaving(false);
        return;
      }

      // Use Supabase auth to update email (sends confirmation)
      const { error } = await supabase.auth.updateUser({
        email: editEmail,
      });

      if (error) {
        toast.error('Failed to initiate email change: ' + error.message);
      } else {
        toast.success('Email change initiated — check your new email for a confirmation link');
        setShowEmailChange(false);
      }
    } catch (err) {
      console.error('Email change error:', err);
      toast.error('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const resendLoginLink = async () => {
    if (!profile?.email) {
      toast.error('No email address on file');
      return;
    }

    setSendingLink(true);
    try {
      if (!isSupabaseConfigured) {
        toast.success('Login link sent to ' + profile.email);
        setSendingLink(false);
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: profile.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        toast.error('Failed to send login link: ' + error.message);
      } else {
        toast.success('Login link sent to ' + profile.email);
      }
    } catch (err) {
      console.error('Resend link error:', err);
      toast.error('An error occurred');
    } finally {
      setSendingLink(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/client/auth');
  };

  const formatTimezone = (tz: string): string => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short',
      });
      const parts = formatter.formatToParts(now);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return `${tz.replace(/_/g, ' ')} (${tzPart?.value || ''})`;
    } catch {
      return tz.replace(/_/g, ' ');
    }
  };

  const formatDate = (dateStr: string): string => {
    const tz = profile?.timezone || 'America/New_York';
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-indigo-200 rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Unable to load profile. Please try again.</p>
            <Button onClick={() => navigate('/client/dashboard')} className="mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Rubik]">My Profile</h1>
          <p className="text-sm text-gray-500">Manage your personal information</p>
        </div>
        {!isEditing && (
          <Button
            onClick={startEditing}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>
        {/* Profile Information Card */}
        <Card className="border-amber-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 font-[Rubik]">
              <User className="h-5 w-5 text-indigo-600" />
              Personal Information
            </CardTitle>
            <CardDescription>
              {isEditing ? 'Update your personal details below' : 'Your account information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your full name"
                    className={errors.name ? 'border-red-300 focus:ring-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className={errors.phone ? 'border-red-300 focus:ring-red-500' : ''}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500">{errors.phone}</p>
                  )}
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-sm font-medium text-gray-700">
                    Time Zone <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="timezone"
                    value={editTimezone}
                    onChange={(e) => setEditTimezone(e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.timezone ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select timezone...</option>
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {formatTimezone(tz)}
                      </option>
                    ))}
                  </select>
                  {errors.timezone && (
                    <p className="text-sm text-red-500">{errors.timezone}</p>
                  )}
                </div>

                {/* Email Change Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={profile.email || ''}
                      disabled
                      className="bg-gray-50 text-gray-500"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailChange(!showEmailChange)}
                      className="whitespace-nowrap text-xs"
                    >
                      {showEmailChange ? 'Cancel' : 'Change Email'}
                    </Button>
                  </div>
                  {showEmailChange && (
                    <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                      <p className="text-sm text-amber-800">
                        A confirmation link will be sent to your new email address.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="new-email@example.com"
                          className={errors.email ? 'border-red-300' : ''}
                        />
                        <Button
                          onClick={initiateEmailChange}
                          disabled={saving || !editEmail}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send Link
                        </Button>
                      </div>
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={saveProfile}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        Saving...
                      </span>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={cancelEditing}
                    variant="outline"
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-4">
                <ProfileField
                  icon={<User className="h-4 w-4 text-indigo-500" />}
                  label="Name"
                  value={profile.name}
                />
                <ProfileField
                  icon={<Mail className="h-4 w-4 text-indigo-500" />}
                  label="Email"
                  value={profile.email || 'Not set'}
                  badge={profile.email ? 'Verified' : undefined}
                />
                <ProfileField
                  icon={<Phone className="h-4 w-4 text-indigo-500" />}
                  label="Phone"
                  value={profile.phone || 'Not set'}
                />
                <ProfileField
                  icon={<Globe className="h-4 w-4 text-indigo-500" />}
                  label="Time Zone"
                  value={formatTimezone(profile.timezone)}
                />
                <ProfileField
                  icon={<Calendar className="h-4 w-4 text-indigo-500" />}
                  label="Member Since"
                  value={formatDate(profile.created_at)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timezone Info Card */}
        {!isEditing && (
          <Card className="border-amber-100 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 font-[Rubik] text-base">
                <Globe className="h-5 w-5 text-amber-600" />
                Time Zone Settings
              </CardTitle>
              <CardDescription>
                All consultation and booking times are displayed in your selected timezone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <p className="font-medium text-gray-900">{formatTimezone(profile.timezone)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Current time: {new Date().toLocaleTimeString('en-US', { timeZone: profile.timezone, hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  className="border-amber-200 text-amber-700 hover:bg-amber-100"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security & Account Card */}
        <Card className="border-amber-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 font-[Rubik] text-base">
              <Shield className="h-5 w-5 text-indigo-600" />
              Security & Account
            </CardTitle>
            <CardDescription>
              Manage your login and account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Re-send Login Link */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 text-sm">Re-send Login Link</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send a new magic link to your email for quick login
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resendLoginLink}
                disabled={sendingLink}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                {sendingLink ? (
                  <span className="animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </>
                )}
              </Button>
            </div>

            <Separator />

            {/* Logout */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 text-sm">Logout</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sign out of your account on this device
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>

            <Separator />

            {/* Delete Account (Phase 2 Stub) */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-60">
              <div>
                <p className="font-medium text-gray-900 text-sm">Delete Account</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="border-gray-200 text-gray-400"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Coming Soon
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

// Helper component for profile fields in view mode
function ProfileField({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
        </div>
      </div>
      {badge && (
        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
          <Check className="h-3 w-3 mr-1" />
          {badge}
        </Badge>
      )}
    </div>
  );
}