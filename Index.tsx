import { Link } from 'react-router-dom';
import { Search, ShieldCheck, Truck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, DBProduct, DBCategory } from '@/lib/supabase';

const CATEGORY_ICONS: Record<string, string> = {
  tools: '🔮',
  beads: '📿',
  books: '📖',
  readings: '✨',
  ritual: '🕯️',
  art: '🎭',
};

function formatPrice(price: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<DBCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<DBProduct[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
    fetchFeaturedProducts();
  }, []);

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from(TABLES.categories)
        .select('*')
        .order('name');
      if (!error && data) {
        setCategories(data);
      }
    } catch {
      // Silent
    }
  }

  async function fetchFeaturedProducts() {
    try {
      const { data, error } = await supabase
        .from(TABLES.products)
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error && data) {
        setFeaturedProducts(data);
        // Fetch seller names
        const sellerIds = [...new Set(data.map((p) => p.seller_id))];
        if (sellerIds.length > 0) {
          const { data: profiles } = await supabase
            .from(TABLES.profiles)
            .select('id, full_name, email')
            .in('id', sellerIds);
          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach((p) => {
              names[p.id] = p.full_name || p.email?.split('@')[0] || 'Seller';
            });
            setSellerNames(names);
          }
        }
      }
    } catch {
      // Silent
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-heading font-bold tracking-tight mb-6">
              Discover Sacred <span className="text-primary">Ifá</span> Divination
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Authentic divination tools, sacred items, and spiritual readings from verified practitioners worldwide.
            </p>
            <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, readings, practitioners..."
                  className="pl-10 h-12"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-8">Search</Button>
            </form>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Popular:</span>
              {['Opele Chain', 'Ikin Nuts', 'Cowrie Shells', 'Book a Reading'].map((term) => (
                <Link
                  key={term}
                  to={`/products?search=${encodeURIComponent(term)}`}
                  className="text-sm text-primary hover:underline"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-heading font-bold mb-8 text-center">Browse Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link key={cat.id} to={`/products?category=${cat.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-3xl mb-3">{CATEGORY_ICONS[cat.slug] || '📦'}</span>
                  <span className="text-sm font-medium">{cat.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-heading font-bold">Featured Products</h2>
              <Link to="/products">
                <Button variant="outline">View All</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <Link key={product.id} to={`/products/${product.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">🔮</span>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">by {sellerNames[product.seller_id] || 'Seller'}</p>
                      <p className="font-bold text-primary">{formatPrice(product.price, product.currency || 'USD')}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust Signals */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Verified Practitioners</h3>
              <p className="text-sm text-muted-foreground">All sellers are verified authentic practitioners of Ifá tradition.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Worldwide Shipping</h3>
              <p className="text-sm text-muted-foreground">Sacred items carefully packaged and shipped to your doorstep.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Secure Payments</h3>
              <p className="text-sm text-muted-foreground">Protected transactions with Stripe. Your payment info is never stored.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Become a Seller */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading font-bold mb-4">Share Your Sacred Knowledge</h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join our community of practitioners. List your divination tools, sacred items, or offer spiritual readings.
          </p>
          <Link to="/auth?mode=seller">
            <Button variant="secondary" size="lg">Become a Seller</Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}