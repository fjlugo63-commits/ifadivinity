import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Edit3,
  AlertTriangle,
  HandHeart,
  Gift,
  Crown,
  Droplets,
  Shield,
  Sparkles,
  Flame,
  HelpingHand,
  Compass,
  ShoppingBag,
  Plus,
  X,
  Loader2,
  ClipboardList,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, DBEbo, DBIreOsogbo, EboCategory, EboItem, EboRecommendations } from '@/lib/supabase';
import { toast } from 'sonner';

// Helper to call the ebo workflow edge function
async function callEboAPI(action: string, method: string = 'GET', body?: Record<string, unknown>, params?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const searchParams = new URLSearchParams({ action, ...params });
  const url = `${supabaseUrl}/functions/v1/app_ebo_workflow?${searchParams.toString()}`;

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// Icon mapping for Ebo categories
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ebo_riru: HandHeart,
  ebo_ipese: Gift,
  ebo_ibori: Crown,
  ebo_itegun: Droplets,
  ebo_isun: Shield,
  ebo_iwefa: Sparkles,
  ebo_idana: Flame,
  ebo_iranwo: HelpingHand,
  ebo_isokan: Compass,
};

// Status color mapping
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
};

interface EboPanelProps {
  consultationId: string;
  outcomeConfirmed: boolean;
  outcome: DBIreOsogbo | null;
  ebo: DBEbo | null;
  onEboChange: (ebo: DBEbo | null) => void;
}

export default function EboPanel({
  consultationId,
  outcomeConfirmed,
  outcome,
  ebo,
  onEboChange,
}: EboPanelProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // Selection state
  const [categories, setCategories] = useState<EboCategory[]>([]);
  const [items, setItems] = useState<EboItem[]>([]);
  const [recommendations, setRecommendations] = useState<EboRecommendations | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [updateReason, setUpdateReason] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Loading states
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch categories and items
  const fetchCategoriesAndItems = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const [catData, itemData] = await Promise.all([
        callEboAPI('categories', 'GET'),
        callEboAPI('items', 'GET'),
      ]);
      setCategories(catData.categories || []);
      setItems(itemData.items || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load Ebo data';
      console.error(message);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!consultationId || !outcomeConfirmed) return;
    try {
      const data = await callEboAPI('recommendations', 'GET', undefined, {
        consultation_id: consultationId,
      });
      setRecommendations(data.recommendations || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load recommendations';
      console.error(message);
    }
  }, [consultationId, outcomeConfirmed]);

  useEffect(() => {
    if (outcomeConfirmed) {
      fetchRecommendations();
    }
  }, [outcomeConfirmed, fetchRecommendations]);

  const handleOpenSelector = (update: boolean = false) => {
    setIsUpdateMode(update);
    setUpdateReason('');
    
    if (update && ebo) {
      setSelectedCategory(ebo.ebo_category);
      setSelectedItems(ebo.ebo_items || []);
      setInstructions(ebo.instructions || '');
    } else {
      // Pre-populate from recommendations
      setSelectedCategory(recommendations?.categories?.[0] || null);
      setSelectedItems(recommendations?.items || []);
      setInstructions('');
    }
    
    fetchCategoriesAndItems();
    setSelectorOpen(true);
  };

  const handleItemToggle = (itemKey: string) => {
    setSelectedItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(k => k !== itemKey)
        : [...prev, itemKey]
    );
  };

  const handleProceedToConfirm = () => {
    if (selectedCategory && selectedItems.length > 0) {
      setSelectorOpen(false);
      setConfirmOpen(true);
    }
  };

  const handleConfirm = async () => {
    if (!selectedCategory || selectedItems.length === 0 || !consultationId) return;
    setSaving(true);

    try {
      if (isUpdateMode) {
        const data = await callEboAPI('update-ebo', 'PUT', {
          consultation_id: consultationId,
          ebo_category: selectedCategory,
          ebo_items: selectedItems,
          instructions: instructions || null,
          update_reason: updateReason || null,
        });
        onEboChange(data.ebo);
        toast.warning('Ebo prescription updated', {
          description: `Updated to ${categories.find(c => c.key === selectedCategory)?.label}`,
        });
      } else {
        const data = await callEboAPI('save-ebo', 'POST', {
          consultation_id: consultationId,
          ebo_category: selectedCategory,
          ebo_items: selectedItems,
          instructions: instructions || null,
        });
        onEboChange(data.ebo);
        toast.success('Ebo confirmed and saved', {
          description: `${categories.find(c => c.key === selectedCategory)?.label} prescribed`,
        });
      }
      setConfirmOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save Ebo';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || !consultationId) return;
    setSaving(true);

    try {
      const data = await callEboAPI('update-status', 'PUT', {
        consultation_id: consultationId,
        status: newStatus,
      });
      onEboChange(data.ebo);
      setStatusDialogOpen(false);
      toast.success('Ebo status updated', {
        description: `Status changed to ${STATUS_COLORS[newStatus]?.label}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // If outcome not confirmed yet, show gated state
  if (!outcomeConfirmed) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
            <ClipboardList className="h-5 w-5" />
            Ebo Workflow
          </CardTitle>
          <CardDescription>
            Awaiting Ire/Osogbo confirmation before Ebo can be prescribed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center bg-muted/20 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              ⏳ Confirm Ire/Osogbo outcome to unlock this panel
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If ebo already confirmed, show the result card
  if (ebo) {
    const categoryInfo = categories.length > 0
      ? categories.find(c => c.key === ebo.ebo_category)
      : null;
    const CategoryIcon = CATEGORY_ICONS[ebo.ebo_category] || ClipboardList;
    const statusInfo = STATUS_COLORS[ebo.status] || STATUS_COLORS.pending;

    return (
      <>
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-700">
                <ClipboardList className="h-5 w-5 text-indigo-500" />
                Ebo Prescription
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`${statusInfo.bg} ${statusInfo.text} border-0`}>
                  {statusInfo.label}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewStatus(ebo.status);
                    setStatusDialogOpen(true);
                  }}
                  className="text-xs h-7 gap-1"
                >
                  Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenSelector(true)}
                  className="text-xs h-7 gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Category */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-100/50">
              <div className="p-2 rounded-full bg-indigo-200">
                <CategoryIcon className="h-5 w-5 text-indigo-700" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold">
                  {categoryInfo?.label || ebo.ebo_category}
                </h4>
                <p className="text-sm text-indigo-600">
                  {categoryInfo?.meaning || 'Ritual prescription'}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Required Items
              </p>
              <div className="flex flex-wrap gap-2">
                {ebo.ebo_items.map((itemKey) => {
                  const itemInfo = items.find(i => i.key === itemKey);
                  const botanicaAvailable = itemInfo?.botanica_available;
                  return (
                    <Badge
                      key={itemKey}
                      variant="secondary"
                      className="text-xs gap-1"
                    >
                      <Package className="h-3 w-3" />
                      {itemInfo?.label || itemKey}
                      {botanicaAvailable && (
                        <ShoppingBag className="h-3 w-3 text-emerald-600 ml-1" />
                      )}
                    </Badge>
                  );
                })}
              </div>
              {ebo.ebo_items.some(itemKey => items.find(i => i.key === itemKey)?.botanica_available) && (
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" />
                  Some items available in Botanica
                </p>
              )}
            </div>

            {/* Instructions */}
            {ebo.instructions && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                  Instructions
                </p>
                <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                  {ebo.instructions}
                </div>
              </div>
            )}

            <Separator className="my-3" />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Confirmed: {new Date(ebo.confirmed_at).toLocaleString()}</span>
              {ebo.updated_at && (
                <span className="text-amber-600">
                  Updated: {new Date(ebo.updated_at).toLocaleString()}
                </span>
              )}
            </div>
            {ebo.update_reason && (
              <p className="text-xs text-amber-600 mt-1">
                Update reason: {ebo.update_reason}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status Update Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Update Ebo Status</DialogTitle>
              <DialogDescription>
                Change the current status of this Ebo prescription.
              </DialogDescription>
            </DialogHeader>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={saving || newStatus === ebo.status}>
                {saving ? 'Updating...' : 'Update Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // No ebo yet — show initialization prompt
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Ebo Workflow
          </CardTitle>
          <CardDescription>
            Prescribe the Ebo required based on the {outcome?.outcome_type === 'ire' ? 'Ire' : 'Osogbo'} outcome
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            {recommendations && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg text-left">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Recommended based on outcome:
                </p>
                <div className="flex flex-wrap gap-1">
                  {recommendations.categories.map(catKey => {
                    const cat = categories.find(c => c.key === catKey);
                    return (
                      <Badge key={catKey} variant="outline" className="text-xs">
                        {cat?.label || catKey}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-muted-foreground text-sm mb-4">
              Select the Ebo category, required items, and provide instructions
            </p>
            <Button onClick={() => handleOpenSelector(false)} className="gap-2">
              <Plus className="h-4 w-4" />
              Prescribe Ebo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ebo Selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isUpdateMode ? (
                <>
                  <Edit3 className="h-5 w-5 text-amber-500" />
                  Update Ebo Prescription
                </>
              ) : (
                <>
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Prescribe Ebo
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Select the Ebo category, ritual items, and provide instructions.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Step 1: Category Selection */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                  Select Ebo Category
                </h4>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const Icon = CATEGORY_ICONS[cat.key] || ClipboardList;
                      const isRecommended = recommendations?.categories?.includes(cat.key);
                      const isSelected = selectedCategory === cat.key;
                      return (
                        <div
                          key={cat.key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : isRecommended
                              ? 'border-amber-300 bg-amber-50/50 hover:border-primary/50'
                              : 'border-border hover:border-primary/50 hover:bg-muted/30'
                          }`}
                          onClick={() => setSelectedCategory(cat.key)}
                        >
                          <div className={`p-2 rounded-full ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cat.label}</p>
                            <p className="text-xs text-muted-foreground">{cat.meaning}</p>
                          </div>
                          {isRecommended && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                              Rec
                            </Badge>
                          )}
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Step 2: Item Selection */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                  Select Ritual Items
                  {selectedItems.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      {selectedItems.length} selected
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => {
                    const isSelected = selectedItems.includes(item.key);
                    const isRecommended = recommendations?.items?.includes(item.key);
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : isRecommended
                            ? 'border-amber-200 bg-amber-50/30 hover:border-primary/50'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleItemToggle(item.key)}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.meaning}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.botanica_available && (
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 gap-0.5">
                              <ShoppingBag className="h-2.5 w-2.5" />
                              Botanica
                            </Badge>
                          )}
                          {isRecommended && !isSelected && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                              Rec
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Step 3: Instructions */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
                  Ritual Instructions
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </h4>
                <Textarea
                  placeholder="Enter detailed ritual instructions, step-by-step guidance, or house-specific variations..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              {/* Update reason (if editing) */}
              {isUpdateMode && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Reason for Update
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </h4>
                  <Textarea
                    placeholder="Why is the Ebo being changed?"
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                {selectedCategory ? '✓ Category' : '○ Category'} •{' '}
                {selectedItems.length > 0 ? `✓ ${selectedItems.length} items` : '○ Items'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectorOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleProceedToConfirm}
                  disabled={!selectedCategory || selectedItems.length === 0}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isUpdateMode ? 'Review Update' : 'Review & Confirm'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isUpdateMode ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Confirm Ebo Update
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Confirm Ebo Prescription
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isUpdateMode
                ? 'You are about to update the Ebo prescription. This action will be logged.'
                : 'Please confirm the Ebo prescription for this consultation.'}
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            {/* Category */}
            <div className="flex items-center gap-3">
              {selectedCategory && (
                <>
                  {(() => {
                    const Icon = CATEGORY_ICONS[selectedCategory] || ClipboardList;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <div>
                    <p className="font-medium">
                      {categories.find(c => c.key === selectedCategory)?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {categories.find(c => c.key === selectedCategory)?.meaning}
                    </p>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Items ({selectedItems.length})</p>
              <div className="flex flex-wrap gap-1">
                {selectedItems.map(itemKey => (
                  <Badge key={itemKey} variant="secondary" className="text-xs">
                    {items.find(i => i.key === itemKey)?.label || itemKey}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Instructions preview */}
            {instructions && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Instructions</p>
                  <p className="text-sm line-clamp-3">{instructions}</p>
                </div>
              </>
            )}
          </div>

          {isUpdateMode && updateReason && (
            <div className="text-sm">
              <p className="text-xs font-medium text-amber-600">Update reason:</p>
              <p className="text-xs text-muted-foreground">{updateReason}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isUpdateMode ? 'Confirm Update' : 'Confirm Ebo'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}