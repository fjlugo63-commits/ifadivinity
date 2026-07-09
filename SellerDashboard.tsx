import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, DollarSign, Eye, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES, DBProduct, DBCategory, DBOrder, DBProfile } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [categories, setCategories] = useState<DBCategory[]>([]);
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [sellerProfile, setSellerProfile] = useState<DBProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DBProduct | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<string>('product');
  const [durationMinutes, setDurationMinutes] = useState('90');

  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchProducts();
      fetchOrders();
      fetchSellerProfile();
    }
  }, [user]);

  async function fetchSellerProfile() {
    try {
      const { data, error } = await supabase
        .from(TABLES.profiles)
        .select('*')
        .eq('id', user!.id)
        .single();
      if (!error && data) setSellerProfile(data);
    } catch {
      // Silent
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from(TABLES.categories)
        .select('*')
        .order('name');
      if (!error && data) setCategories(data);
    } catch {
      // Silent
    }
  }

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.products)
        .select('*')
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders() {
    try {
      const { data: orderItems, error: itemsError } = await supabase
        .from(TABLES.order_items)
        .select('order_id')
        .eq('seller_id', user!.id);

      if (!itemsError && orderItems && orderItems.length > 0) {
        const orderIds = [...new Set(orderItems.map((oi) => oi.order_id))];
        const { data, error } = await supabase
          .from(TABLES.orders)
          .select('*')
          .in('id', orderIds)
          .order('created_at', { ascending: false });
        if (!error && data) setOrders(data);
      }
    } catch {
      // Silent
    }
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setTitle('');
    setDescription('');
    setPriceDollars('');
    setCategoryId('');
    setStockQuantity('1');
    setIsActive(true);
    setProductImages([]);
    setServiceType('product');
    setDurationMinutes('90');
    setDialogOpen(true);
  }

  function openEditDialog(product: DBProduct) {
    setEditingProduct(product);
    setTitle(product.title);
    setDescription(product.description || '');
    setPriceDollars(product.price.toString());
    setCategoryId(product.category_id || '');
    setStockQuantity((product.stock_quantity ?? 1).toString());
    setIsActive(product.status === 'active');
    setProductImages(product.images || []);
    setServiceType(product.service_type || 'product');
    setDurationMinutes((product.duration_minutes ?? 90).toString());
    setDialogOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(priceDollars);

    // Prevent Egbo service creation if not verified
    if (serviceType === 'egbo' && !sellerProfile?.verified_egbo) {
      toast.error('You must be verified for Egbo services before creating Egbo listings. Please contact admin.');
      return;
    }

    const productData = {
      title,
      slug: slugify(title),
      description,
      price,
      currency: 'USD',
      category_id: categoryId || null,
      stock_quantity: serviceType === 'egbo' ? null : parseInt(stockQuantity),
      status: isActive ? 'active' : 'draft',
      seller_id: user!.id,
      images: productImages,
      service_type: serviceType === 'product' ? null : serviceType,
      duration_minutes: serviceType === 'egbo' ? parseInt(durationMinutes) : null,
      is_digital: serviceType === 'egbo',
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from(TABLES.products)
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        await logAudit('product.updated', 'products', editingProduct.id, { title, service_type: serviceType });
        toast.success('Product updated');
      } else {
        const { data, error } = await supabase
          .from(TABLES.products)
          .insert(productData)
          .select('id')
          .single();
        if (error) throw error;
        await logAudit('product.created', 'products', data?.id, { title, service_type: serviceType });
        toast.success('Product created');
      }
      setDialogOpen(false);
      fetchProducts();
    } catch {
      toast.error('Failed to save product. Please try again.');
    }
  }

  async function handleDeleteProduct(id: string) {
    try {
      const product = products.find((p) => p.id === id);
      const { error } = await supabase.from(TABLES.products).delete().eq('id', id);
      if (error) throw error;
      await logAudit('product.deleted', 'products', id, { title: product?.title });
      toast.success('Product deleted');
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  }

  function getCategoryName(catId: string | null) {
    if (!catId) return 'Uncategorized';
    const cat = categories.find((c) => c.id === catId);
    return cat?.name || 'Uncategorized';
  }

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const egboProducts = products.filter((p) => p.service_type === 'egbo');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold">Seller Dashboard</h1>
            {sellerProfile?.verified_egbo && (
              <Badge variant="default" className="bg-green-600 text-white">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Egbo Verified
              </Badge>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Create New Product'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveProduct} className="space-y-4">
                {/* Service Type Selection */}
                <div className="space-y-2">
                  <Label>Listing Type</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Physical Product</SelectItem>
                      <SelectItem value="egbo" disabled={!sellerProfile?.verified_egbo}>
                        Egbo Service {!sellerProfile?.verified_egbo && '(Verification Required)'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {serviceType === 'egbo' && !sellerProfile?.verified_egbo && (
                    <p className="text-xs text-amber-600">
                      You need Egbo verification to create service listings. Contact admin for approval.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">{serviceType === 'egbo' ? 'Service Title' : 'Product Title'}</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (USD)</Label>
                    <Input id="price" type="number" step="0.01" min="0" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} required />
                  </div>
                  {serviceType === 'egbo' ? (
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input id="duration" type="number" min="15" step="15" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock Quantity</Label>
                      <Input id="stock" type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} required />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <ImageUpload images={productImages} onImagesChange={setProductImages} maxImages={5} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Active (visible to buyers)</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Verification Notice */}
        {!sellerProfile?.verified_egbo && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-4 p-4">
              <ShieldCheck className="h-8 w-8 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Egbo Verification Pending</p>
                <p className="text-sm text-amber-700">
                  To offer Egbo divination services, you need admin verification. Your profile is in the review queue.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Products</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{egboProducts.length}</p>
                <p className="text-sm text-muted-foreground">Egbo Services</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <Eye className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Revenue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-6 bg-muted rounded w-1/3" /></CardContent></Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No products yet</p>
                  <p className="text-muted-foreground mb-4">Create your first product listing to start selling.</p>
                  <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover rounded" />
                          ) : (
                            <span>{product.service_type === 'egbo' ? '🔮' : '📦'}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{product.title}</h3>
                            {product.service_type === 'egbo' && (
                              <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Egbo</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{getCategoryName(product.category_id)}</Badge>
                            <span className="text-sm text-muted-foreground">{formatPrice(product.price)}</span>
                            {product.service_type === 'egbo' ? (
                              <span className="text-sm text-muted-foreground">• {product.duration_minutes} min</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">• {product.stock_quantity ?? 0} in stock</span>
                            )}
                            {product.status !== 'active' && <Badge variant="secondary" className="text-xs">{product.status}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground">No orders received yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                        {order.notes && <p className="text-xs text-amber-600 mt-1">{order.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(order.total_amount)}</p>
                        <Badge variant={
                          order.status === 'paid' || order.status === 'completed' ? 'default' :
                          order.status === 'cancelled' || order.status === 'refunded' ? 'destructive' : 'secondary'
                        }>{order.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}