import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Star, Truck, ShieldCheck, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useCart } from '@/contexts/CartContext';
import { supabase, TABLES, DBProduct } from '@/lib/supabase';
import { toast } from 'sonner';

function formatPrice(price: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState<DBProduct | null>(null);
  const [sellerName, setSellerName] = useState('Seller');
  const [sellerVerified, setSellerVerified] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (id) fetchProduct(id);
  }, [id]);

  async function fetchProduct(productId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.products)
        .select('*')
        .eq('id', productId)
        .single();

      if (!error && data) {
        setProduct(data);
        // Fetch seller name and verification status
        const { data: profile } = await supabase
          .from(TABLES.profiles)
          .select('full_name, email, verified_egbo')
          .eq('id', data.seller_id)
          .single();
        if (profile) {
          setSellerName(profile.full_name || profile.email?.split('@')[0] || 'Seller');
          setSellerVerified(profile.verified_egbo || false);
        }
        // Fetch category name
        if (data.category_id) {
          const { data: cat } = await supabase
            .from(TABLES.categories)
            .select('name')
            .eq('id', data.category_id)
            .single();
          if (cat) setCategoryName(cat.name);
        }
      } else {
        setProduct(null);
      }
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart() {
    if (!product) return;
    const isEgbo = product.service_type === 'egbo';

    addItem({
      id: product.id,
      title: product.title,
      price_cents: Math.round(product.price * 100),
      currency: product.currency || 'USD',
      image_url: product.images?.[0] || '',
      seller_name: sellerName,
      seller_id: product.seller_id,
      service_type: product.service_type,
    });

    if (!isEgbo) {
      // For regular products, add additional quantity
      for (let i = 1; i < quantity; i++) {
        addItem({
          id: product.id,
          title: product.title,
          price_cents: Math.round(product.price * 100),
          currency: product.currency || 'USD',
          image_url: product.images?.[0] || '',
          seller_name: sellerName,
          seller_id: product.seller_id,
          service_type: product.service_type,
        });
      }
    }

    toast.success(isEgbo ? 'Egbo service added to cart' : `Added ${quantity} item(s) to cart`);
  }

  const isEgbo = product?.service_type === 'egbo';
  const stockQty = product?.stock_quantity ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 animate-pulse">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/4" />
              <div className="h-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-4">Product not found</p>
            <Button onClick={() => navigate('/products')}>Back to Products</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-8xl">{isEgbo ? '🔮' : '📦'}</span>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {categoryName && <Badge variant="outline">{categoryName}</Badge>}
                {isEgbo && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">Egbo Service</Badge>
                )}
              </div>
              <h1 className="text-3xl font-heading font-bold">{product.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">by {sellerName}</p>
                {sellerVerified && (
                  <Badge variant="default" className="bg-green-600 text-xs">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-sm text-muted-foreground">(12 reviews)</span>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-primary">
                {formatPrice(product.price, product.currency || 'USD')}
              </p>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <p className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price, product.currency || 'USD')}
                </p>
              )}
            </div>

            {/* Egbo Service Details */}
            {isEgbo && product.duration_minutes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-amber-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Egbo Divination Service
                </h3>
                <div className="flex items-center gap-4 text-sm text-amber-800">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {product.duration_minutes} minutes
                  </span>
                  <span>• Virtual session via video call</span>
                </div>
                <p className="text-xs text-amber-700">
                  After purchase, a booking will be created and you&apos;ll receive a meeting link.
                </p>
              </div>
            )}

            <Separator />

            <div className="whitespace-pre-line text-muted-foreground">
              {product.description}
            </div>

            <Separator />

            <div className="space-y-4">
              {!isEgbo && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(stockQty || 99, quantity + 1))}
                      disabled={quantity >= (stockQty || 99)}
                    >
                      +
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {stockQty > 0 ? `${stockQty} available` : 'In stock'}
                  </span>
                </div>
              )}

              <Button
                onClick={handleAddToCart}
                size="lg"
                className="w-full"
                disabled={!isEgbo && stockQty === 0 && product.stock_quantity !== null}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {isEgbo ? 'Book Egbo Session' : (stockQty === 0 && product.stock_quantity !== null ? 'Out of Stock' : 'Add to Cart')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isEgbo ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    <span>Flexible scheduling</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4" />
                    <span>Ships worldwide</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span>{sellerVerified ? 'Verified practitioner' : 'Verified seller'}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}