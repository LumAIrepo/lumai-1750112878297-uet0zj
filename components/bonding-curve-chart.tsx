'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipItem
} from 'chart.js'
import { formatNumber } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface BondingCurveChartProps {
  currentSupply: number
  maxSupply: number
  currentPrice: number
  virtualSolReserves: number
  virtualTokenReserves: number
  className?: string
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  animate?: boolean
}

interface ChartDataPoint {
  x: number
  y: number
  supply: number
  marketCap: number
}

export default function BondingCurveChart({
  currentSupply,
  maxSupply,
  currentPrice,
  virtualSolReserves,
  virtualTokenReserves,
  className = '',
  height = 300,
  showGrid = true,
  showTooltip = true,
  animate = true
}: BondingCurveChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate bonding curve data points
  const chartData = useMemo(() => {
    try {
      if (!maxSupply || !virtualSolReserves || !virtualTokenReserves) {
        throw new Error('Invalid bonding curve parameters')
      }

      const dataPoints: ChartDataPoint[] = []
      const steps = 100
      const stepSize = maxSupply / steps

      // Generate curve points using constant product formula
      // Price = virtualSolReserves / (virtualTokenReserves - supply)
      for (let i = 0; i <= steps; i++) {
        const supply = i * stepSize
        const remainingTokens = virtualTokenReserves - supply
        
        if (remainingTokens <= 0) break

        const price = virtualSolReserves / remainingTokens
        const marketCap = supply * price

        dataPoints.push({
          x: supply,
          y: price,
          supply,
          marketCap
        })
      }

      return dataPoints
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate bonding curve')
      return []
    }
  }, [maxSupply, virtualSolReserves, virtualTokenReserves])

  // Find current position on curve
  const currentPosition = useMemo(() => {
    if (!chartData.length) return null
    
    const closestPoint = chartData.reduce((prev, curr) => 
      Math.abs(curr.supply - currentSupply) < Math.abs(prev.supply - currentSupply) 
        ? curr 
        : prev
    )
    
    return closestPoint
  }, [chartData, currentSupply])

  // Chart configuration
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: animate ? {
      duration: 1000,
      easing: 'easeInOutQuart'
    } : false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: showTooltip,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: () => 'Bonding Curve',
          label: (context: TooltipItem<'line'>) => {
            const point = chartData[context.dataIndex]
            if (!point) return ''
            
            return [
              `Supply: ${formatNumber(point.supply)} tokens`,
              `Price: ${point.y.toFixed(6)} SOL`,
              `Market Cap: ${formatNumber(point.marketCap)} SOL`
            ]
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        display: true,
        grid: {
          display: showGrid,
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) => formatNumber(Number(value))
        },
        title: {
          display: true,
          text: 'Token Supply',
          color: '#9ca3af'
        }
      },
      y: {
        type: 'linear',
        display: true,
        grid: {
          display: showGrid,
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) => `${Number(value).toFixed(6)} SOL`
        },
        title: {
          display: true,
          text: 'Price (SOL)',
          color: '#9ca3af'
        }
      }
    }
  }

  const data = {
    datasets: [
      {
        label: 'Bonding Curve',
        data: chartData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#3b82f6',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2
      },
      // Current position indicator
      ...(currentPosition ? [{
        label: 'Current Position',
        data: [currentPosition],
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }] : [])
    ]
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800 ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️</div>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800 ${className}`} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-800 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Bonding Curve</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-400">Price Curve</span>
          </div>
          {currentPosition && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-400">Current</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="relative" style={{ height }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
      
      {currentPosition && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Current Supply</p>
            <p className="text-white font-semibold">{formatNumber(currentSupply)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Current Price</p>
            <p className="text-white font-semibold">{currentPrice.toFixed(6)} SOL</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 mb-1">Market Cap</p>
            <p className="text-white font-semibold">{formatNumber(currentPosition.marketCap)} SOL</p>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Progress: {((currentSupply / maxSupply) * 100).toFixed(2)}% to graduation
      </div>
    </div>
  )
}