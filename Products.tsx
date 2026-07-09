import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { supabase, TABLES, DBProduct, DBCategory } from '@/lib/supabase';

function formatPrice(price: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [categories, setCategories] = useState<DBCategory[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [categorySlug, setCategorySlug] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [categorySlug, sortBy, categories]);

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

  async function fetchProducts() {
    setLoading(true);
    try {
      let query = supabase.from(TABLES.products).select('*').eq('status', 'active');

      if (categorySlug && categorySlug !== 'all') {
        // Find category ID by slug
        const cat = categories.find((c) => c.slug === categorySlug);
        if (cat) {
          query = query.eq('category_id', cat.id);
        }
      }

      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery.trim()}%`);
      }

      if (sortBy === 'price_low') {
        query = query.order('price', { ascending: true });
      } else if (sortBy === 'price_high') {
        query = query.order('price', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (!error && data) {
        setProducts(data);
        // Fetch seller names for these products
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
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    setSearchParams(params);
    fetchProducts();
  }

  function handleCategoryChange(value: string) {
    setCategorySlug(value);
    const params = new URLSearchParams(searchParams);
    if (value !== 'all') {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return 'Uncategorized';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || 'Uncategorized';
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          <div className="flex gap-2">
            <Select value={categorySlug} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {categorySlug !== 'all' && (
          <div className="mb-4">
            <Badge variant="secondary" className="text-sm">
              {categories.find((c) => c.slug === categorySlug)?.name || categorySlug}
              <button onClick={() => handleCategoryChange('all')} className="ml-2 hover:text-destructive">×</button>
            </Badge>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-muted" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-5 bg-muted rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
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
                    <Badge variant="outline" className="text-xs mb-2">{getCategoryName(product.category_id)}</Badge>
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">by {sellerNames[product.seller_id] || 'Seller'}</p>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-primary">{formatPrice(product.price, product.currency || 'USD')}</p>
                      {product.stock_quantity !== null && product.stock_quantity <= 3 && product.stock_quantity > 0 && (
                        <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 && !loading && (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">No products found matching your criteria.</p>
            <Button variant="outline" className="mt-4" onClick={() => { handleCategoryChange('all'); setSearchQuery(''); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}