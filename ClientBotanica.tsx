import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Leaf, Star, ArrowRight } from 'lucide-react';

export default function ClientBotanica() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-[Rubik]">Botanica Marketplace</h1>
        <p className="text-sm text-gray-500 mt-1">Sacred herbs, tools, and spiritual supplies</p>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-amber-100 shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-xl font-[Rubik] text-gray-900">Coming Soon</CardTitle>
          <CardDescription className="text-gray-600 max-w-md mx-auto">
            The Botanica Marketplace is being prepared. Soon you&apos;ll be able to browse and purchase sacred herbs, 
            divination tools, and spiritual supplies recommended by your Awo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preview Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
              <Leaf className="h-6 w-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Sacred Herbs</p>
              <p className="text-xs text-gray-500 mt-1">Ewe for rituals & healing</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <Star className="h-6 w-6 text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Divination Tools</p>
              <p className="text-xs text-gray-500 mt-1">Opele, Ikin & accessories</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
              <ShoppingBag className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Ebo Supplies</p>
              <p className="text-xs text-gray-500 mt-1">Materials for offerings</p>
            </div>
          </div>

          {/* Notification Signup */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Get notified when we launch</p>
              <p className="text-xs text-gray-500 mt-0.5">We&apos;ll send you an email when the marketplace is ready</p>
            </div>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <ArrowRight className="h-3 w-3 mr-1" />
              Phase 1
            </Badge>
          </div>

          {/* Back to Dashboard */}
          <div className="text-center pt-2">
            <Button
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => window.history.back()}
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}