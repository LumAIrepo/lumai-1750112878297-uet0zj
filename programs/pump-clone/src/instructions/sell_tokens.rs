use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"token_launch", token_launch.creator.as_ref(), token_launch.mint.as_ref()],
        bump = token_launch.bump,
        constraint = token_launch.is_active @ PumpError::LaunchNotActive,
        constraint = !token_launch.migrated @ PumpError::AlreadyMigrated
    )]
    pub token_launch: Account<'info, TokenLaunch>,
    
    #[account(
        mut,
        constraint = seller_token_account.mint == token_launch.mint @ PumpError::InvalidMint,
        constraint = seller_token_account.owner == seller.key() @ PumpError::InvalidOwner
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", token_launch.key().as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        mut,
        constraint = curve_token_account.mint == token_launch.mint @ PumpError::InvalidMint,
        constraint = curve_token_account.owner == bonding_curve.key() @ PumpError::InvalidOwner
    )]
    pub curve_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = curve_sol_account.owner == bonding_curve.key() @ PumpError::InvalidOwner
    )]
    pub curve_sol_account: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn sell_tokens(ctx: Context<SellTokens>, token_amount: u64) -> Result<()> {
    let token_launch = &mut ctx.accounts.token_launch;
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    let seller = &ctx.accounts.seller;
    let seller_token_account = &ctx.accounts.seller_token_account;
    let curve_token_account = &ctx.accounts.curve_token_account;
    let curve_sol_account = &ctx.accounts.curve_sol_account;

    // Validate token amount
    require!(token_amount > 0, PumpError::InvalidAmount);
    require!(
        seller_token_account.amount >= token_amount,
        PumpError::InsufficientTokenBalance
    );

    // Calculate SOL amount to return based on bonding curve
    let current_supply = bonding_curve.total_supply;
    let new_supply = current_supply
        .checked_sub(token_amount)
        .ok_or(PumpError::MathOverflow)?;

    // Calculate SOL amount using bonding curve formula
    let sol_amount = calculate_sell_price(current_supply, new_supply, bonding_curve.k)?;
    
    // Apply sell fee
    let fee_amount = sol_amount
        .checked_mul(bonding_curve.sell_fee_bps as u64)
        .ok_or(PumpError::MathOverflow)?
        .checked_div(10000)
        .ok_or(PumpError::MathOverflow)?;
    
    let net_sol_amount = sol_amount
        .checked_sub(fee_amount)
        .ok_or(PumpError::MathOverflow)?;

    // Validate curve has enough SOL
    require!(
        curve_sol_account.lamports() >= sol_amount,
        PumpError::InsufficientCurveBalance
    );

    // Transfer tokens from seller to curve
    let transfer_tokens_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: seller_token_account.to_account_info(),
            to: curve_token_account.to_account_info(),
            authority: seller.to_account_info(),
        },
    );
    token::transfer(transfer_tokens_ctx, token_amount)?;

    // Transfer SOL from curve to seller
    let curve_seeds = &[
        b"bonding_curve",
        token_launch.key().as_ref(),
        &[bonding_curve.bump],
    ];
    let curve_signer = &[&curve_seeds[..]];

    **curve_sol_account.to_account_info().try_borrow_mut_lamports()? -= sol_amount;
    **seller.to_account_info().try_borrow_mut_lamports()? += net_sol_amount;

    // Update bonding curve state
    bonding_curve.total_supply = new_supply;
    bonding_curve.sol_reserves = bonding_curve.sol_reserves
        .checked_sub(sol_amount)
        .ok_or(PumpError::MathOverflow)?;
    bonding_curve.total_fees = bonding_curve.total_fees
        .checked_add(fee_amount)
        .ok_or(PumpError::MathOverflow)?;

    // Update token launch stats
    token_launch.total_transactions = token_launch.total_transactions
        .checked_add(1)
        .ok_or(PumpError::MathOverflow)?;
    token_launch.volume = token_launch.volume
        .checked_add(sol_amount)
        .ok_or(PumpError::MathOverflow)?;

    // Emit sell event
    emit!(TokenSellEvent {
        seller: seller.key(),
        token_launch: token_launch.key(),
        token_amount,
        sol_amount: net_sol_amount,
        fee_amount,
        new_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

fn calculate_sell_price(current_supply: u64, new_supply: u64, k: u64) -> Result<u64> {
    // Bonding curve formula: price = k * supply
    // Integral from new_supply to current_supply: k * (current_supply^2 - new_supply^2) / 2
    
    let current_supply_squared = (current_supply as u128)
        .checked_mul(current_supply as u128)
        .ok_or(PumpError::MathOverflow)?;
    
    let new_supply_squared = (new_supply as u128)
        .checked_mul(new_supply as u128)
        .ok_or(PumpError::MathOverflow)?;
    
    let supply_diff = current_supply_squared
        .checked_sub(new_supply_squared)
        .ok_or(PumpError::MathOverflow)?;
    
    let sol_amount = (k as u128)
        .checked_mul(supply_diff)
        .ok_or(PumpError::MathOverflow)?
        .checked_div(2)
        .ok_or(PumpError::MathOverflow)?;
    
    // Convert back to u64, ensuring no overflow
    u64::try_from(sol_amount).map_err(|_| PumpError::MathOverflow.into())
}

#[event]
pub struct TokenSellEvent {
    pub seller: Pubkey,
    pub token_launch: Pubkey,
    pub token_amount: u64,
    pub sol_amount: u64,
    pub fee_amount: u64,
    pub new_supply: u64,
    pub timestamp: i64,
}