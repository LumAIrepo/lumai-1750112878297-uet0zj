import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number, decimals: number = 2): string {
  if (num === 0) return "0"
  
  if (num < 0.01) {
    return num.toExponential(2)
  }
  
  if (num < 1000) {
    return num.toFixed(decimals)
  }
  
  if (num < 1000000) {
    return (num / 1000).toFixed(decimals) + "K"
  }
  
  if (num < 1000000000) {
    return (num / 1000000).toFixed(decimals) + "M"
  }
  
  return (num / 1000000000).toFixed(decimals) + "B"
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount)
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`
}

export function formatTokenAmount(amount: number | string | BN, decimals: number = 6): string {
  let numAmount: number
  
  if (amount instanceof BN) {
    numAmount = amount.toNumber() / Math.pow(10, decimals)
  } else if (typeof amount === "string") {
    numAmount = parseFloat(amount) / Math.pow(10, decimals)
  } else {
    numAmount = amount / Math.pow(10, decimals)
  }
  
  return formatNumber(numAmount)
}

export function formatSolAmount(lamports: number | string | BN): string {
  let numLamports: number
  
  if (lamports instanceof BN) {
    numLamports = lamports.toNumber()
  } else if (typeof lamports === "string") {
    numLamports = parseFloat(lamports)
  } else {
    numLamports = lamports
  }
  
  const sol = numLamports / LAMPORTS_PER_SOL
  return formatNumber(sol, 4)
}

export function lamportsToSol(lamports: number | string | BN): number {
  let numLamports: number
  
  if (lamports instanceof BN) {
    numLamports = lamports.toNumber()
  } else if (typeof lamports === "string") {
    numLamports = parseFloat(lamports)
  } else {
    numLamports = lamports
  }
  
  return numLamports / LAMPORTS_PER_SOL
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return ""
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function calculateBondingCurvePrice(
  supply: number,
  reserveRatio: number = 0.5,
  basePrice: number = 0.0001
): number {
  if (supply <= 0) return basePrice
  return basePrice * Math.pow(supply, 1 / reserveRatio - 1)
}

export function calculateTokensFromSol(
  solAmount: number,
  currentSupply: number,
  reserveRatio: number = 0.5,
  basePrice: number = 0.0001
): number {
  if (solAmount <= 0) return 0
  
  const currentPrice = calculateBondingCurvePrice(currentSupply, reserveRatio, basePrice)
  const avgPrice = (currentPrice + calculateBondingCurvePrice(currentSupply + 1000, reserveRatio, basePrice)) / 2
  
  return solAmount / avgPrice
}

export function calculateSolFromTokens(
  tokenAmount: number,
  currentSupply: number,
  reserveRatio: number = 0.5,
  basePrice: number = 0.0001
): number {
  if (tokenAmount <= 0) return 0
  
  const currentPrice = calculateBondingCurvePrice(currentSupply, reserveRatio, basePrice)
  const newSupply = Math.max(0, currentSupply - tokenAmount)
  const newPrice = calculateBondingCurvePrice(newSupply, reserveRatio, basePrice)
  const avgPrice = (currentPrice + newPrice) / 2
  
  return tokenAmount * avgPrice
}

export function calculateMarketCap(supply: number, price: number): number {
  return supply * price
}

export function calculatePriceImpact(
  tradeAmount: number,
  currentSupply: number,
  isBuy: boolean = true,
  reserveRatio: number = 0.5,
  basePrice: number = 0.0001
): number {
  const currentPrice = calculateBondingCurvePrice(currentSupply, reserveRatio, basePrice)
  
  let newSupply: number
  if (isBuy) {
    const tokensReceived = calculateTokensFromSol(tradeAmount, currentSupply, reserveRatio, basePrice)
    newSupply = currentSupply + tokensReceived
  } else {
    newSupply = Math.max(0, currentSupply - tradeAmount)
  }
  
  const newPrice = calculateBondingCurvePrice(newSupply, reserveRatio, basePrice)
  return ((newPrice - currentPrice) / currentPrice) * 100
}

export function validateTokenMetadata(metadata: {
  name?: string
  symbol?: string
  description?: string
  image?: string
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!metadata.name || metadata.name.trim().length === 0) {
    errors.push("Token name is required")
  } else if (metadata.name.length > 32) {
    errors.push("Token name must be 32 characters or less")
  }
  
  if (!metadata.symbol || metadata.symbol.trim().length === 0) {
    errors.push("Token symbol is required")
  } else if (metadata.symbol.length > 10) {
    errors.push("Token symbol must be 10 characters or less")
  } else if (!/^[A-Z0-9]+$/.test(metadata.symbol)) {
    errors.push("Token symbol must contain only uppercase letters and numbers")
  }
  
  if (metadata.description && metadata.description.length > 500) {
    errors.push("Token description must be 500 characters or less")
  }
  
  if (metadata.image && !isValidUrl(metadata.image)) {
    errors.push("Token image must be a valid URL")
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

export function generateRandomSeed(): number {
  return Math.floor(Math.random() * 1000000)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export function getTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return `${seconds}s ago`
  }
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function generateTokenId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function calculateSlippage(expectedAmount: number, actualAmount: number): number {
  if (expectedAmount === 0) return 0
  return ((expectedAmount - actualAmount) / expectedAmount) * 100
}

export function applySlippage(amount: number, slippagePercent: number, isMinimum: boolean = true): number {
  const slippageMultiplier = slippagePercent / 100
  
  if (isMinimum) {
    return amount * (1 - slippageMultiplier)
  } else {
    return amount * (1 + slippageMultiplier)
  }
}

export function getExplorerUrl(signature: string, cluster: string = "mainnet-beta"): string {
  const baseUrl = "https://explorer.solana.com"
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`
  return `${baseUrl}/tx/${signature}${clusterParam}`
}

export function getTokenExplorerUrl(mint: string, cluster: string = "mainnet-beta"): string {
  const baseUrl = "https://explorer.solana.com"
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`
  return `${baseUrl}/address/${mint}${clusterParam}`
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => false)
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "")
}

export function validateSolAmount(amount: string): { isValid: boolean; error?: string } {
  const num = parseFloat(amount)
  
  if (isNaN(num)) {
    return { isValid: false, error: "Invalid number" }
  }
  
  if (num <= 0) {
    return { isValid: false, error: "Amount must be greater than 0" }
  }
  
  if (num > 1000000) {
    return { isValid: false, error: "Amount too large" }
  }
  
  return { isValid: true }
}

export function formatLargeNumber(num: number): string {
  if (num >= 1e12) {
    return (num / 1e12).toFixed(1) + "T"
  }
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + "B"
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + "M"
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + "K"
  }
  return num.toString()
}

export function getRandomColor(): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function generateGradient(): string {
  const color1 = getRandomColor()
  const color2 = getRandomColor()
  return `linear-gradient(135deg, ${color1}, ${color2})`
}