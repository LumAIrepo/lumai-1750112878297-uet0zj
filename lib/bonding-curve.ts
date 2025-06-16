import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface BondingCurveParams {
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialVirtualTokenReserves: BN;
}

export interface TradeResult {
  amountOut: BN;
  newSolReserves: BN;
  newTokenReserves: BN;
  priceImpact: number;
  fee: BN;
}

export interface PriceInfo {
  currentPrice: number;
  marketCap: number;
  progress: number;
  nextPrice: number;
}

export class BondingCurve {
  private static readonly FEE_BASIS_POINTS = 100; // 1%
  private static readonly BASIS_POINTS = 10000;
  private static readonly GRADUATION_THRESHOLD = new BN(85_000_000_000); // 85 SOL
  private static readonly MAX_SUPPLY = new BN(1_000_000_000_000_000); // 1B tokens with 6 decimals
  private static readonly DECIMALS = 6;

  /**
   * Calculate the amount of tokens received for a given SOL amount (buy)
   */
  static calculateBuyAmount(
    solAmount: BN,
    params: BondingCurveParams
  ): TradeResult {
    if (solAmount.lte(new BN(0))) {
      throw new Error('SOL amount must be greater than 0');
    }

    // Calculate fee
    const fee = solAmount.mul(new BN(this.FEE_BASIS_POINTS)).div(new BN(this.BASIS_POINTS));
    const solAmountAfterFee = solAmount.sub(fee);

    // Use constant product formula: x * y = k
    const k = params.virtualSolReserves.mul(params.virtualTokenReserves);
    const newSolReserves = params.virtualSolReserves.add(solAmountAfterFee);
    const newTokenReserves = k.div(newSolReserves);
    
    const tokensOut = params.virtualTokenReserves.sub(newTokenReserves);

    if (tokensOut.lte(new BN(0))) {
      throw new Error('Insufficient liquidity');
    }

    // Check if we have enough real token reserves
    if (tokensOut.gt(params.realTokenReserves)) {
      throw new Error('Insufficient token reserves');
    }

    // Calculate price impact
    const oldPrice = this.getCurrentPrice(params);
    const newParams = {
      ...params,
      virtualSolReserves: newSolReserves,
      virtualTokenReserves: newTokenReserves,
      realSolReserves: params.realSolReserves.add(solAmountAfterFee),
      realTokenReserves: params.realTokenReserves.sub(tokensOut)
    };
    const newPrice = this.getCurrentPrice(newParams);
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

    return {
      amountOut: tokensOut,
      newSolReserves: newSolReserves,
      newTokenReserves: newTokenReserves,
      priceImpact,
      fee
    };
  }

  /**
   * Calculate the amount of SOL received for a given token amount (sell)
   */
  static calculateSellAmount(
    tokenAmount: BN,
    params: BondingCurveParams
  ): TradeResult {
    if (tokenAmount.lte(new BN(0))) {
      throw new Error('Token amount must be greater than 0');
    }

    if (tokenAmount.gt(params.realTokenReserves)) {
      throw new Error('Insufficient token reserves');
    }

    // Use constant product formula: x * y = k
    const k = params.virtualSolReserves.mul(params.virtualTokenReserves);
    const newTokenReserves = params.virtualTokenReserves.add(tokenAmount);
    const newSolReserves = k.div(newTokenReserves);
    
    const solOut = params.virtualSolReserves.sub(newSolReserves);

    if (solOut.lte(new BN(0))) {
      throw new Error('Insufficient liquidity');
    }

    // Check if we have enough real SOL reserves
    if (solOut.gt(params.realSolReserves)) {
      throw new Error('Insufficient SOL reserves');
    }

    // Calculate fee
    const fee = solOut.mul(new BN(this.FEE_BASIS_POINTS)).div(new BN(this.BASIS_POINTS));
    const solOutAfterFee = solOut.sub(fee);

    // Calculate price impact
    const oldPrice = this.getCurrentPrice(params);
    const newParams = {
      ...params,
      virtualSolReserves: newSolReserves,
      virtualTokenReserves: newTokenReserves,
      realSolReserves: params.realSolReserves.sub(solOut),
      realTokenReserves: params.realTokenReserves.add(tokenAmount)
    };
    const newPrice = this.getCurrentPrice(newParams);
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

    return {
      amountOut: solOutAfterFee,
      newSolReserves: newSolReserves,
      newTokenReserves: newTokenReserves,
      priceImpact,
      fee
    };
  }

  /**
   * Get current token price in SOL
   */
  static getCurrentPrice(params: BondingCurveParams): number {
    const solReserves = params.virtualSolReserves.toNumber() / Math.pow(10, 9); // Convert lamports to SOL
    const tokenReserves = params.virtualTokenReserves.toNumber() / Math.pow(10, this.DECIMALS);
    
    if (tokenReserves === 0) {
      return 0;
    }
    
    return solReserves / tokenReserves;
  }

  /**
   * Get comprehensive price information
   */
  static getPriceInfo(params: BondingCurveParams): PriceInfo {
    const currentPrice = this.getCurrentPrice(params);
    const totalSupply = this.MAX_SUPPLY.sub(params.realTokenReserves);
    const marketCap = currentPrice * (totalSupply.toNumber() / Math.pow(10, this.DECIMALS));
    
    // Calculate progress towards graduation
    const progress = Math.min(
      (params.realSolReserves.toNumber() / this.GRADUATION_THRESHOLD.toNumber()) * 100,
      100
    );

    // Calculate next price for small buy (0.01 SOL)
    const smallBuyAmount = new BN(10_000_000); // 0.01 SOL in lamports
    try {
      const buyResult = this.calculateBuyAmount(smallBuyAmount, params);
      const nextParams = {
        ...params,
        virtualSolReserves: buyResult.newSolReserves,
        virtualTokenReserves: buyResult.newTokenReserves
      };
      const nextPrice = this.getCurrentPrice(nextParams);
      
      return {
        currentPrice,
        marketCap,
        progress,
        nextPrice
      };
    } catch {
      return {
        currentPrice,
        marketCap,
        progress,
        nextPrice: currentPrice
      };
    }
  }

  /**
   * Check if token is ready for graduation to Raydium
   */
  static isReadyForGraduation(params: BondingCurveParams): boolean {
    return params.realSolReserves.gte(this.GRADUATION_THRESHOLD);
  }

  /**
   * Calculate initial bonding curve parameters for a new token
   */
  static getInitialParams(): BondingCurveParams {
    const initialVirtualSolReserves = new BN(30_000_000_000); // 30 SOL
    const initialVirtualTokenReserves = new BN(1_073_000_000_000_000); // 1.073B tokens
    
    return {
      virtualSolReserves: initialVirtualSolReserves,
      virtualTokenReserves: initialVirtualTokenReserves,
      realSolReserves: new BN(0),
      realTokenReserves: this.MAX_SUPPLY,
      initialVirtualSolReserves,
      initialVirtualTokenReserves
    };
  }

  /**
   * Validate bonding curve parameters
   */
  static validateParams(params: BondingCurveParams): boolean {
    try {
      // Check that reserves are positive
      if (params.virtualSolReserves.lte(new BN(0)) || 
          params.virtualTokenReserves.lte(new BN(0)) ||
          params.realSolReserves.lt(new BN(0)) ||
          params.realTokenReserves.lt(new BN(0))) {
        return false;
      }

      // Check that real reserves don't exceed virtual reserves
      if (params.realSolReserves.gt(params.virtualSolReserves) ||
          params.realTokenReserves.gt(params.virtualTokenReserves)) {
        return false;
      }

      // Check that total token supply is consistent
      const circulatingSupply = this.MAX_SUPPLY.sub(params.realTokenReserves);
      if (circulatingSupply.lt(new BN(0)) || circulatingSupply.gt(this.MAX_SUPPLY)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate slippage for a trade
   */
  static calculateSlippage(
    expectedAmount: BN,
    actualAmount: BN,
    isBuy: boolean
  ): number {
    if (expectedAmount.eq(new BN(0))) {
      return 0;
    }

    const difference = expectedAmount.sub(actualAmount).abs();
    const slippage = (difference.toNumber() / expectedAmount.toNumber()) * 100;
    
    return isBuy ? -slippage : slippage; // Negative for buys (getting less), positive for sells
  }

  /**
   * Get minimum amount out with slippage tolerance
   */
  static getMinAmountOut(
    expectedAmount: BN,
    slippageToleranceBps: number
  ): BN {
    const slippageMultiplier = new BN(this.BASIS_POINTS - slippageToleranceBps);
    return expectedAmount.mul(slippageMultiplier).div(new BN(this.BASIS_POINTS));
  }

  /**
   * Calculate the amount needed to reach a specific price
   */
  static calculateAmountToReachPrice(
    targetPrice: number,
    params: BondingCurveParams,
    isBuy: boolean
  ): BN {
    const currentPrice = this.getCurrentPrice(params);
    
    if (isBuy && targetPrice <= currentPrice) {
      throw new Error('Target price must be higher than current price for buy');
    }
    
    if (!isBuy && targetPrice >= currentPrice) {
      throw new Error('Target price must be lower than current price for sell');
    }

    // Binary search to find the amount needed
    let low = new BN(1);
    let high = isBuy ? params.realSolReserves : params.realTokenReserves;
    let result = new BN(0);
    
    const tolerance = 0.001; // 0.1% tolerance
    
    for (let i = 0; i < 100; i++) { // Max 100 iterations
      const mid = low.add(high).div(new BN(2));
      
      try {
        const tradeResult = isBuy 
          ? this.calculateBuyAmount(mid, params)
          : this.calculateSellAmount(mid, params);
          
        const newParams = {
          ...params,
          virtualSolReserves: tradeResult.newSolReserves,
          virtualTokenReserves: tradeResult.newTokenReserves
        };
        
        const newPrice = this.getCurrentPrice(newParams);
        const priceDiff = Math.abs(newPrice - targetPrice) / targetPrice;
        
        if (priceDiff < tolerance) {
          result = mid;
          break;
        }
        
        if ((isBuy && newPrice < targetPrice) || (!isBuy && newPrice > targetPrice)) {
          low = mid.add(new BN(1));
        } else {
          high = mid.sub(new BN(1));
        }
      } catch {
        if (isBuy) {
          high = mid.sub(new BN(1));
        } else {
          low = mid.add(new BN(1));
        }
      }
      
      if (low.gt(high)) {
        break;
      }
    }
    
    return result;
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount: BN, decimals: number = this.DECIMALS): string {
    const divisor = new BN(10).pow(new BN(decimals));
    const whole = amount.div(divisor);
    const remainder = amount.mod(divisor);
    
    if (remainder.eq(new BN(0))) {
      return whole.toString();
    }
    
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    
    if (trimmedRemainder === '') {
      return whole.toString();
    }
    
    return `${whole.toString()}.${trimmedRemainder}`;
  }

  /**
   * Parse amount from string
   */
  static parseAmount(amountStr: string, decimals: number = this.DECIMALS): BN {
    if (!amountStr || amountStr.trim() === '') {
      throw new Error('Amount cannot be empty');
    }
    
    const parts = amountStr.trim().split('.');
    if (parts.length > 2) {
      throw new Error('Invalid amount format');
    }
    
    const wholePart = parts[0] || '0';
    const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
    
    const wholeAmount = new BN(wholePart).mul(new BN(10).pow(new BN(decimals)));
    const fractionalAmount = fractionalPart ? new BN(fractionalPart) : new BN(0);
    
    return wholeAmount.add(fractionalAmount);
  }
}

export default BondingCurve;