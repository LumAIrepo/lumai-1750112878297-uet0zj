import { AnchorProvider, Program, web3, BN, utils } from '@project-serum/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { IDL, PumpClone } from './idl';

export const PROGRAM_ID = new PublicKey('PumpCLoneProgram11111111111111111111111111');
export const BONDING_CURVE_SEED = 'bonding_curve';
export const TOKEN_METADATA_SEED = 'token_metadata';
export const GLOBAL_STATE_SEED = 'global_state';

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  websiteUri?: string;
  telegramUri?: string;
  twitterUri?: string;
  initialSupply: number;
  reserveRatio: number;
}

export interface TradeParams {
  tokenMint: PublicKey;
  amount: BN;
  minAmountOut: BN;
  isBuy: boolean;
}

export class ProgramClient {
  private program: Program<PumpClone>;
  private provider: AnchorProvider;
  private connection: Connection;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    this.program = new Program(IDL, PROGRAM_ID, this.provider);
  }

  async initializeGlobalState(authority: PublicKey): Promise<TransactionInstruction> {
    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      PROGRAM_ID
    );

    return await this.program.methods
      .initializeGlobalState()
      .accounts({
        globalState,
        authority,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  async createToken(params: TokenLaunchParams, creator: PublicKey): Promise<{
    instructions: TransactionInstruction[];
    tokenMint: PublicKey;
    bondingCurve: PublicKey;
  }> {
    const tokenMint = Keypair.generate();
    
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [tokenMetadata] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_METADATA_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      PROGRAM_ID
    );

    const creatorTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      creator
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      bondingCurve,
      true
    );

    const instructions: TransactionInstruction[] = [];

    // Create associated token account for creator if needed
    try {
      await this.connection.getAccountInfo(creatorTokenAccount);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          creator,
          creatorTokenAccount,
          creator,
          tokenMint.publicKey
        )
      );
    }

    // Create associated token account for bonding curve
    instructions.push(
      createAssociatedTokenAccountInstruction(
        creator,
        bondingCurveTokenAccount,
        bondingCurve,
        tokenMint.publicKey
      )
    );

    // Create token instruction
    const createTokenIx = await this.program.methods
      .createToken(
        params.name,
        params.symbol,
        params.description,
        params.imageUri,
        params.websiteUri || '',
        params.telegramUri || '',
        params.twitterUri || '',
        new BN(params.initialSupply * LAMPORTS_PER_SOL),
        params.reserveRatio
      )
      .accounts({
        tokenMint: tokenMint.publicKey,
        bondingCurve,
        tokenMetadata,
        globalState,
        creator,
        creatorTokenAccount,
        bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    instructions.push(createTokenIx);

    return {
      instructions,
      tokenMint: tokenMint.publicKey,
      bondingCurve,
    };
  }

  async buyTokens(params: TradeParams, buyer: PublicKey): Promise<TransactionInstruction[]> {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      PROGRAM_ID
    );

    const buyerTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      buyer
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      bondingCurve,
      true
    );

    const instructions: TransactionInstruction[] = [];

    // Create associated token account for buyer if needed
    try {
      await this.connection.getAccountInfo(buyerTokenAccount);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          params.tokenMint
        )
      );
    }

    const buyIx = await this.program.methods
      .buyTokens(params.amount, params.minAmountOut)
      .accounts({
        tokenMint: params.tokenMint,
        bondingCurve,
        globalState,
        buyer,
        buyerTokenAccount,
        bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    instructions.push(buyIx);
    return instructions;
  }

  async sellTokens(params: TradeParams, seller: PublicKey): Promise<TransactionInstruction[]> {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      PROGRAM_ID
    );

    const sellerTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      seller
    );

    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      bondingCurve,
      true
    );

    const sellIx = await this.program.methods
      .sellTokens(params.amount, params.minAmountOut)
      .accounts({
        tokenMint: params.tokenMint,
        bondingCurve,
        globalState,
        seller,
        sellerTokenAccount,
        bondingCurveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    return [sellIx];
  }

  async getBondingCurveData(tokenMint: PublicKey) {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    try {
      return await this.program.account.bondingCurve.fetch(bondingCurve);
    } catch (error) {
      throw new Error(`Failed to fetch bonding curve data: ${error}`);
    }
  }

  async getTokenMetadata(tokenMint: PublicKey) {
    const [tokenMetadata] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_METADATA_SEED), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    try {
      return await this.program.account.tokenMetadata.fetch(tokenMetadata);
    } catch (error) {
      throw new Error(`Failed to fetch token metadata: ${error}`);
    }
  }

  async getGlobalState() {
    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      PROGRAM_ID
    );

    try {
      return await this.program.account.globalState.fetch(globalState);
    } catch (error) {
      throw new Error(`Failed to fetch global state: ${error}`);
    }
  }

  async calculateBuyPrice(tokenMint: PublicKey, amount: BN): Promise<BN> {
    try {
      const bondingCurveData = await this.getBondingCurveData(tokenMint);
      
      // Bonding curve formula: price = reserve_ratio * (total_supply / virtual_sol_reserves)
      const currentSupply = bondingCurveData.realTokenReserves;
      const virtualSolReserves = bondingCurveData.virtualSolReserves;
      const reserveRatio = bondingCurveData.reserveRatio;

      // Calculate price using bonding curve mathematics
      const newSupply = currentSupply.add(amount);
      const priceIntegral = this.calculatePriceIntegral(currentSupply, newSupply, virtualSolReserves, reserveRatio);
      
      return priceIntegral;
    } catch (error) {
      throw new Error(`Failed to calculate buy price: ${error}`);
    }
  }

  async calculateSellPrice(tokenMint: PublicKey, amount: BN): Promise<BN> {
    try {
      const bondingCurveData = await this.getBondingCurveData(tokenMint);
      
      const currentSupply = bondingCurveData.realTokenReserves;
      const virtualSolReserves = bondingCurveData.virtualSolReserves;
      const reserveRatio = bondingCurveData.reserveRatio;

      if (currentSupply.lt(amount)) {
        throw new Error('Insufficient token supply for sale');
      }

      const newSupply = currentSupply.sub(amount);
      const priceIntegral = this.calculatePriceIntegral(newSupply, currentSupply, virtualSolReserves, reserveRatio);
      
      return priceIntegral;
    } catch (error) {
      throw new Error(`Failed to calculate sell price: ${error}`);
    }
  }

  private calculatePriceIntegral(fromSupply: BN, toSupply: BN, virtualSolReserves: BN, reserveRatio: number): BN {
    // Simplified bonding curve calculation
    // In production, this would use more sophisticated mathematical formulas
    const avgSupply = fromSupply.add(toSupply).div(new BN(2));
    const price = virtualSolReserves.mul(new BN(reserveRatio * 1000)).div(avgSupply).div(new BN(1000));
    const amount = toSupply.sub(fromSupply);
    
    return price.mul(amount).div(new BN(LAMPORTS_PER_SOL));
  }

  async getAllTokens(): Promise<any[]> {
    try {
      const accounts = await this.program.account.tokenMetadata.all();
      return accounts.map(account => ({
        publicKey: account.publicKey,
        ...account.account,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch all tokens: ${error}`);
    }
  }

  async getTokensByCreator(creator: PublicKey): Promise<any[]> {
    try {
      const accounts = await this.program.account.tokenMetadata.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: creator.toBase58(),
          },
        },
      ]);
      return accounts.map(account => ({
        publicKey: account.publicKey,
        ...account.account,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch tokens by creator: ${error}`);
    }
  }

  async getRecentTrades(tokenMint?: PublicKey, limit: number = 100): Promise<any[]> {
    try {
      // This would typically fetch from transaction logs or a separate indexing service
      // For now, return empty array as this requires additional infrastructure
      return [];
    } catch (error) {
      throw new Error(`Failed to fetch recent trades: ${error}`);
    }
  }

  getProgramId(): PublicKey {
    return PROGRAM_ID;
  }

  getProvider(): AnchorProvider {
    return this.provider;
  }

  getProgram(): Program<PumpClone> {
    return this.program;
  }
}

export function createProgramClient(connection: Connection, wallet: any): ProgramClient {
  return new ProgramClient(connection, wallet);
}