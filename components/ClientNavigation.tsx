import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured, TABLES } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  CalendarPlus,
  History,
  CreditCard,
  MessageSquare,
  User,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

export function ClientNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchUnreadCount = async () => {
    if (!isSupabaseConfigured || !user) {
      setUnreadCount(2); // Mock unread count
      return;
    }

    try {
      const { data: clientData } = await supabase
        .from(TABLES.clients)
        .select('id')
        .eq('email', user.email)
        .eq('status', 'active')
        .single();

      if (clientData) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', clientData.id)
          .eq('is_read', false);

        setUnreadCount(count || 0);
      }
    } catch {
      // Silently fail
    }
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/client/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Book Consultation', path: '/client/bookings', icon: <CalendarPlus className="h-4 w-4" /> },
    { label: 'Consultations', path: '/client/consultations', icon: <History className="h-4 w-4" /> },
    { label: 'Payments', path: '/client/payments', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Messages', path: '/client/messages', icon: <MessageSquare className="h-4 w-4" />, badge: unreadCount },
    { label: 'Profile', path: '/client/profile', icon: <User className="h-4 w-4" /> },
    { label: 'Botanica', path: '/client/botanica', icon: <ShoppingBag className="h-4 w-4" /> },
  ];

  const isActive = (path: string) => {
    if (path === '/client/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/client/auth');
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900 font-[Rubik] hidden sm:block">IfaDivinity</span>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={`relative rounded-lg text-xs font-medium px-3 py-2 transition-colors ${
                    isActive(item.path)
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span className="ml-1.5">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-red-500 text-white hover:bg-red-500 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden lg:flex rounded-lg text-gray-600 hover:text-red-600 text-xs"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden rounded-lg"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-amber-100 bg-white/95 backdrop-blur-sm">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  onClick={() => navigate(item.path)}
                  className={`w-full justify-start rounded-lg text-sm font-medium px-3 py-2.5 ${
                    isActive(item.path)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs bg-red-500 text-white hover:bg-red-500 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </Button>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full justify-start rounded-lg text-sm font-medium px-3 py-2.5 text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="ml-3">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}