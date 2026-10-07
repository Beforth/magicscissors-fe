import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { productService } from '@/services/product.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Package,
  ArrowRight,
  Loader2,
  ShoppingCart,
} from 'lucide-react'

function LowStockAlertsCard({ maxItems = 5, showViewAll = true }) {
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['low-stock-products'],
    queryFn: () => productService.getLowStock(),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  const lowStockProducts = data?.data || []
  const displayProducts = lowStockProducts.slice(0, maxItems)
  const hasMore = lowStockProducts.length > maxItems

  if (isLoading) {
    return (
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Failed to load low stock data</p>
        </CardContent>
      </Card>
    )
  }

  if (lowStockProducts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-green-700">
            Stock Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-green-600">
            <p className="font-medium">All products in stock</p>
            <p className="text-sm text-green-500">No items below reorder level</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Low Stock Alerts
            <Badge variant="destructive" className="ml-2">
              {lowStockProducts.length}
            </Badge>
          </CardTitle>
          {showViewAll && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => navigate('/inventory')}
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayProducts.map((product) => {
            const stockPercentage = product.reorder_level > 0
              ? Math.round((product.total_stock / product.reorder_level) * 100)
              : 0
            const isCritical = stockPercentage < 25
            const isLow = stockPercentage < 50

            return (
              <div
                key={product.product_id}
                className={`p-3 rounded-lg border ${
                  isCritical
                    ? 'bg-red-50 border-red-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isCritical ? 'bg-red-100' : 'bg-orange-100'
                    }`}>
                      <Package className={`h-5 w-5 ${
                        isCritical ? 'text-red-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        isCritical ? 'text-red-800' : 'text-orange-800'
                      }`}>
                        {product.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.category?.name || 'Uncategorized'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isCritical ? 'destructive' : 'warning'}
                        className={isCritical ? '' : 'bg-orange-100 text-orange-700'}
                      >
                        {product.total_stock} left
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Reorder at {product.reorder_level}
                    </p>
                  </div>
                </div>

                {/* Stock level bar */}
                <div className="mt-2">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isCritical
                          ? 'bg-red-500'
                          : isLow
                            ? 'bg-orange-500'
                            : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(100, stockPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {hasMore && (
            <button
              onClick={() => navigate('/inventory')}
              className="w-full p-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              +{lowStockProducts.length - maxItems} more products low on stock
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default LowStockAlertsCard
