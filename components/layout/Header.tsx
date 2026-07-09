import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';

export default function Header() {
  const { user, userRole, signOut } = useAuth();
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="flex flex-col gap-4 mt-8">
                <Link to="/products" className="text-lg font-medium hover:text-primary">Products</Link>
                <Link to="/bookings" className="text-lg font-medium hover:text-primary">Book a Reading</Link>
                {(userRole === 'seller' || userRole === 'admin') && (
                  <Link to="/awo/dashboard" className="text-lg font-medium hover:text-primary">Awo Dashboard</Link>
                )}
                {userRole === 'seller' && (
                  <Link to="/seller/dashboard" className="text-lg font-medium hover:text-primary">Seller Dashboard</Link>
                )}
                {userRole === 'admin' && (
                  <Link to="/admin" className="text-lg font-medium hover:text-primary">Admin Panel</Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold font-heading text-primary">Ifá Market</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 ml-8">
            <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">Products</Link>
            <Link to="/bookings" className="text-sm font-medium hover:text-primary transition-colors">Book a Reading</Link>
            {(userRole === 'seller' || userRole === 'admin') && (
              <Link to="/awo/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Awo Dashboard</Link>
            )}
            {userRole === 'seller' && (
              <Link to="/seller/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Seller Dashboard</Link>
            )}
            {userRole === 'admin' && (
              <Link to="/admin" className="text-sm font-medium hover:text-primary transition-colors">Admin Panel</Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/products">
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>
          </Link>

          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {totalItems}
                </Badge>
              )}
            </Button>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/orders">My Orders</Link>
                </DropdownMenuItem>
                {(userRole === 'seller' || userRole === 'admin') && (
                  <DropdownMenuItem asChild>
                    <Link to="/awo/dashboard">Awo Dashboard</Link>
                  </DropdownMenuItem>
                )}
                {userRole === 'seller' && (
                  <DropdownMenuItem asChild>
                    <Link to="/seller/dashboard">Seller Dashboard</Link>
                  </DropdownMenuItem>
                )}
                {userRole === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Admin Panel</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}