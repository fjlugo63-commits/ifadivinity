import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Plus, Edit, Home, ShoppingBag } from 'lucide-react';
import { supabase, TABLES } from '@/lib/supabase';
import { toast } from 'sonner';

interface HouseRow {
  id: string;
  name: string;
  description: string | null;
  admin_id: string | null;
  created_at: string;
  admin_name?: string;
  awo_count?: number;
  client_count?: number;
  is_active?: boolean;
}

interface ProductRow {
  id: string;
  title: string;
  category_id: string | null;
  price: number;
  stock_quantity: number | null;
  status: string;
  description: string | null;
  created_at: string;
  category_name?: string;
}

interface OrderRow {
  id: string;
  buyer_id: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  buyer_name?: string;
}

export default function AdminHousesBotanica() {
  const [activeTab, setActiveTab] = useState('houses');

  // Houses state
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [housesLoading, setHousesLoading] = useState(true);
  const [selectedHouse, setSelectedHouse] = useState<HouseRow | null>(null);
  const [showHouseDetail, setShowHouseDetail] = useState(false);
  const [houseAwos, setHouseAwos] = useState<Array<{ id: string; name: string }>>([]);

  // Botanica Products state
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [productForm, setProductForm] = useState({ title: '', description: '', price: '', stock: '', category_id: '' });

  // Botanica Orders state
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    fetchHouses();
    fetchProducts();
    fetchOrders();
  }, []);

  // --- Houses ---
  async function fetchHouses() {
    setHousesLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.ifa_houses)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched: HouseRow[] = await Promise.all(
        (data || []).map(async (h) => {
          const { count: awoCount } = await supabase
            .from(TABLES.house_practitioners)
            .select('id', { count: 'exact', head: true })
            .eq('house_id', h.id);

          let adminName = '';
          if (h.admin_id) {
            const { data: profile } = await supabase
              .from(TABLES.profiles)
              .select('full_name, email')
              .eq('id', h.admin_id)
              .single();
            adminName = profile?.full_name || profile?.email?.split('@')[0] || '';
          }

          return {
            ...h,
            admin_name: adminName,
            awo_count: awoCount || 0,
            client_count: 0,
            is_active: true,
          };
        })
      );

      setHouses(enriched);
    } catch (err) {
      console.error('Error fetching houses:', err);
    } finally {
      setHousesLoading(false);
    }
  }

  async function viewHouseDetail(house: HouseRow) {
    setSelectedHouse(house);
    setShowHouseDetail(true);

    const { data } = await supabase
      .from(TABLES.house_practitioners)
      .select('practitioner_id')
      .eq('house_id', house.id);

    if (data && data.length > 0) {
      const ids = data.map((d) => d.practitioner_id);
      const { data: profiles } = await supabase
        .from(TABLES.profiles)
        .select('id, full_name, email')
        .in('id', ids);

      setHouseAwos(
        (profiles || []).map((p) => ({ id: p.id, name: p.full_name || p.email?.split('@')[0] || 'Unknown' }))
      );
    } else {
      setHouseAwos([]);
    }
  }

  // --- Botanica Products ---
  async function fetchProducts() {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.products)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts((data || []) as ProductRow[]);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  }

  async function saveProduct() {
    const payload = {
      title: productForm.title,
      description: productForm.description,
      price: Math.round(parseFloat(productForm.price || '0') * 100),
      stock_quantity: parseInt(productForm.stock || '0'),
      status: 'active',
      slug: productForm.title.toLowerCase().replace(/\s+/g, '-'),
      seller_id: '00000000-0000-0000-0000-000000000000', // Admin-created
    };

    if (editingProduct) {
      const { error } = await supabase
        .from(TABLES.products)
        .update(payload)
        .eq('id', editingProduct.id);

      if (error) {
        toast.error('Failed to update product');
        return;
      }
      toast.success('Product updated');
    } else {
      const { error } = await supabase.from(TABLES.products).insert(payload);
      if (error) {
        toast.error('Failed to create product');
        return;
      }
      toast.success('Product created');
    }

    setShowProductDialog(false);
    setEditingProduct(null);
    setProductForm({ title: '', description: '', price: '', stock: '', category_id: '' });
    fetchProducts();
  }

  async function toggleProductStatus(product: ProductRow) {
    const newStatus = product.status === 'active' ? 'archived' : 'active';
    const { error } = await supabase
      .from(TABLES.products)
      .update({ status: newStatus })
      .eq('id', product.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p)));
  }

  // --- Botanica Orders ---
  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.orders)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const buyerIds = [...new Set((data || []).map((o) => o.buyer_id).filter(Boolean))];
      const buyerMap: Record<string, string> = {};

      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from(TABLES.profiles)
          .select('id, full_name, email')
          .in('id', buyerIds as string[]);

        (profiles || []).forEach((p) => {
          buyerMap[p.id] = p.full_name || p.email?.split('@')[0] || 'Unknown';
        });
      }

      setOrders(
        (data || []).map((o) => ({
          ...o,
          buyer_name: o.buyer_id ? buyerMap[o.buyer_id] || 'Unknown' : 'Guest',
        }))
      );
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Houses Detail View
  if (showHouseDetail && selectedHouse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowHouseDetail(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">House Detail</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>House Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Name</span>
                <span className="text-sm font-medium">{selectedHouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Admin</span>
                <span className="text-sm font-medium">{selectedHouse.admin_name || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Awos</span>
                <span className="text-sm font-medium">{selectedHouse.awo_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Description</span>
                <span className="text-sm font-medium">{selectedHouse.description || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm font-medium">
                  {new Date(selectedHouse.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Awos in House ({houseAwos.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {houseAwos.length === 0 ? (
                <p className="text-sm text-gray-500">No Awos assigned</p>
              ) : (
                <div className="space-y-2">
                  {houseAwos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="houses" className="gap-2">
              <Home className="w-4 h-4" /> Houses
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <ShoppingBag className="w-4 h-4" /> Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingBag className="w-4 h-4" /> Orders
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Houses Tab */}
        <TabsContent value="houses" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {housesLoading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : houses.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No houses found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Awos</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {houses.map((h) => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{h.name}</td>
                          <td className="px-4 py-3 text-gray-600">{h.admin_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{h.awo_count}</td>
                          <td className="px-4 py-3">
                            <Badge variant="default">Active</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" onClick={() => viewHouseDetail(h)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setProductForm({ title: '', description: '', price: '', stock: '', category_id: '' });
                setShowProductDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> New Product
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {productsLoading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No products found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Stock</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{p.title}</td>
                          <td className="px-4 py-3 text-gray-600">${(p.price / 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-600">{p.stock_quantity ?? '∞'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  title: p.title,
                                  description: p.description || '',
                                  price: (p.price / 100).toFixed(2),
                                  stock: String(p.stock_quantity || 0),
                                  category_id: p.category_id || '',
                                });
                                setShowProductDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleProductStatus(p)}
                            >
                              {p.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No orders found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(o.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-medium">{o.buyer_name}</td>
                          <td className="px-4 py-3 font-medium">${(o.total_amount / 100).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={o.status === 'paid' ? 'default' : 'secondary'}>
                              {o.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Create/Edit Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={productForm.title}
                onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="Product description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowProductDialog(false)}>Cancel</Button>
              <Button onClick={saveProduct} disabled={!productForm.title || !productForm.price}>
                {editingProduct ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}