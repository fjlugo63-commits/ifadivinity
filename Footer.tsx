import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-heading font-bold text-lg mb-4">Ifá Market</h3>
            <p className="text-sm text-muted-foreground">
              Your trusted marketplace for authentic Ifa divination products, sacred tools, and spiritual readings.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Shop</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground">All Products</Link>
              <Link to="/products?category=tools" className="text-sm text-muted-foreground hover:text-foreground">Divination Tools</Link>
              <Link to="/products?category=beads" className="text-sm text-muted-foreground hover:text-foreground">Sacred Beads</Link>
              <Link to="/bookings" className="text-sm text-muted-foreground hover:text-foreground">Book a Reading</Link>
            </nav>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Sellers</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/auth?mode=seller" className="text-sm text-muted-foreground hover:text-foreground">Become a Seller</Link>
              <Link to="/seller/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Seller Dashboard</Link>
            </nav>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <nav className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">help@ifamarket.com</span>
              <span className="text-sm text-muted-foreground">Shipping & Returns</span>
              <span className="text-sm text-muted-foreground">Privacy Policy</span>
            </nav>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          © 2026 Ifá Market. All rights reserved.
        </div>
      </div>
    </footer>
  );
}