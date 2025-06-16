export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export interface BondingCurveConfig {
  virtualTokenReserves: number;
  virtualSolReserves: number;
  realTokenReserves: number;
  realSolReserves: number;
  tokenTotalSupply: number;
  complete: boolean;
}

export interface TokenLaunch {
  publicKey: string;
  mint: string;
  bondingCurve: string;
  associatedBondingCurve: string;
  creator: string;
  metadata: TokenMetadata;
  bondingCurveConfig: BondingCurveConfig;
  createdAt: number;
  marketCapSol: number;
  usdMarketCap: number;
  replies: number;
  lastReply?: number;
  nsfw: boolean;
  marketId?: string;
  inverted?: boolean;
  isComplete: boolean;
  totalSupply: number;
  showName: boolean;
  kingOfTheHillTimestamp?: number;
  marketCapRank?: number;
  lastTradeUnixTime?: number;
  lastTradeHumanTime?: string;
  raydiumPool?: string;
}

export interface TradeEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'buy' | 'sell';
  tokenAmount: number;
  solAmount: number;
  bondingCurveKey: string;
  newTokenReserves: number;
  newSolReserves: number;
  timestamp: number;
  virtualTokenReserves: number;
  virtualSolReserves: number;
  marketCapSol: number;
  user?: UserProfile;
}

export interface UserProfile {
  publicKey: string;
  username?: string;
  profileImage?: string;
  bio?: string;
  twitter?: string;
  website?: string;
  createdAt: number;
  totalTokensCreated: number;
  totalVolume: number;
  followers: number;
  following: number;
  verified: boolean;
}

export interface Comment {
  id: string;
  mint: string;
  user: UserProfile;
  content: string;
  timestamp: number;
  replies: Comment[];
  likes: number;
  userLiked: boolean;
  image?: string;
}

export interface TokenHolder {
  publicKey: string;
  tokenAmount: number;
  percentage: number;
  usdValue: number;
  user?: UserProfile;
}

export interface PriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: number;
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  marketCap: number;
}

export interface GlobalStats {
  totalTokensLaunched: number;
  totalVolume: number;
  totalMarketCap: number;
  activeTraders24h: number;
  completedCurves: number;
  totalFees: number;
}

export interface NotificationData {
  id: string;
  type: 'trade' | 'launch' | 'comment' | 'milestone' | 'complete';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  mint?: string;
  user?: UserProfile;
  data?: any;
}

export interface WalletBalance {
  sol: number;
  tokens: TokenBalance[];
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  usdValue: number;
  metadata?: TokenMetadata;
}

export interface SearchResult {
  tokens: TokenLaunch[];
  users: UserProfile[];
  total: number;
}

export interface FilterOptions {
  sortBy: 'creation_time' | 'last_trade_timestamp' | 'market_cap' | 'volume_24h' | 'replies';
  order: 'desc' | 'asc';
  includeNsfw: boolean;
  createdBy?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  isComplete?: boolean;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  description: string;
  image: File;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export interface TradeParams {
  mint: string;
  amount: number;
  slippageBps: number;
  priorityFee?: number;
}

export interface BuyParams extends TradeParams {
  solAmount: number;
  maxSolCost: number;
}

export interface SellParams extends TradeParams {
  tokenAmount: number;
  minSolOutput: number;
}

export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

export interface WebSocketMessage {
  type: 'trade' | 'launch' | 'comment' | 'price_update' | 'user_update';
  data: any;
  timestamp: number;
}

export interface RaydiumPoolInfo {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue: string;
  lpVault: string;
  marketVersion: number;
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
}

export interface TokenStats {
  holders: number;
  transactions: number;
  volume24h: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  ath: number;
  atl: number;
  athDate: number;
  atlDate: number;
}

export interface TrendingToken extends TokenLaunch {
  rank: number;
  trendingScore: number;
  volumeChange: number;
  holderChange: number;
}

export interface LeaderboardEntry {
  rank: number;
  user: UserProfile;
  metric: number;
  change24h: number;
}

export interface Leaderboard {
  creators: LeaderboardEntry[];
  traders: LeaderboardEntry[];
  holders: LeaderboardEntry[];
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export type SortOption = 'newest' | 'oldest' | 'market_cap' | 'volume' | 'replies' | 'last_trade';

export type TabType = 'terminal' | 'thread' | 'trades' | 'holders';

export type ThemeMode = 'light' | 'dark';

export type NotificationType = 'trade' | 'launch' | 'comment' | 'milestone' | 'complete';

export type TradeType = 'buy' | 'sell';

export type TokenStatus = 'active' | 'completed' | 'migrated';

export interface ErrorWithCode extends Error {
  code?: string | number;
  logs?: string[];
}

export interface RpcError extends Error {
  code: number;
  data?: {
    logs?: string[];
  };
}

export interface InstructionError {
  InstructionError: [number, any];
}

export interface CustomError {
  Custom: number;
}