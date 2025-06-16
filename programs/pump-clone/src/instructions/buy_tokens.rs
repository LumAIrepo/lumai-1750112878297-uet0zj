use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = token_mint,
        constraint = bonding_curve.is_active @ PumpError::BondingCurveInactive
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    let buyer = &ctx.accounts.buyer;
    let token_mint = &ctx.accounts.token_mint;
    
    require!(sol_amount > 0, PumpError::InvalidAmount);
    require!(sol_amount >= bonding_curve.min_buy_amount, PumpError::BelowMinimumBuy);
    require!(sol_amount <= bonding_curve.max_buy_amount, PumpError::AboveMaximumBuy);
    
    // Calculate tokens to mint based on bonding curve
    let tokens_to_mint = calculate_tokens_for_sol(
        sol_amount,
        bonding_curve.virtual_sol_reserves,
        bonding_curve.virtual_token_reserves,
        bonding_curve.real_sol_reserves,
        bonding_curve.real_token_reserves
    )?;
    
    require!(tokens_to_mint >= min_tokens_out, PumpError::SlippageExceeded);
    require!(tokens_to_mint > 0, PumpError::InvalidTokenAmount);
    
    // Check if purchase would exceed graduation threshold
    let new_real_sol_reserves = bonding_curve.real_sol_reserves
        .checked_add(sol_amount)
        .ok_or(PumpError::MathOverflow)?;
    
    if new_real_sol_reserves >= bonding_curve.graduation_threshold {
        return Err(PumpError::GraduationThresholdReached.into());
    }
    
    // Calculate fees
    let fee_amount = sol_amount
        .checked_mul(bonding_curve.fee_basis_points as u64)
        .ok_or(PumpError::MathOverflow)?
        .checked_div(10000)
        .ok_or(PumpError::MathOverflow)?;
    
    let net_sol_amount = sol_amount
        .checked_sub(fee_amount)
        .ok_or(PumpError::MathOverflow)?;
    
    // Transfer SOL from buyer to bonding curve
    let transfer_instruction = anchor_lang::system_program::Transfer {
        from: buyer.to_account_info(),
        to: bonding_curve.to_account_info(),
    };
    
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        ),
        net_sol_amount,
    )?;
    
    // Transfer fee to fee vault
    if fee_amount > 0 {
        let fee_transfer_instruction = anchor_lang::system_program::Transfer {
            from: buyer.to_account_info(),
            to: ctx.accounts.fee_vault.to_account_info(),
        };
        
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                fee_transfer_instruction,
            ),
            fee_amount,
        )?;
    }
    
    // Mint tokens to buyer
    let seeds = &[
        b"bonding_curve",
        token_mint.key().as_ref(),
        &[bonding_curve.bump],
    ];
    let signer_seeds = &[&seeds[..]];
    
    let mint_to_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
            mint: token_mint.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: bonding_curve.to_account_info(),
        },
        signer_seeds,
    );
    
    token::mint_to(mint_to_ctx, tokens_to_mint)?;
    
    // Update bonding curve state
    bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
        .checked_add(net_sol_amount)
        .ok_or(PumpError::MathOverflow)?;
    
    bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
        .checked_sub(tokens_to_mint)
        .ok_or(PumpError::MathOverflow)?;
    
    bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
        .checked_add(net_sol_amount)
        .ok_or(PumpError::MathOverflow)?;
    
    bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
        .checked_sub(tokens_to_mint)
        .ok_or(PumpError::MathOverflow)?;
    
    bonding_curve.total_supply = bonding_curve.total_supply
        .checked_add(tokens_to_mint)
        .ok_or(PumpError::MathOverflow)?;
    
    bonding_curve.last_trade_timestamp = Clock::get()?.unix_timestamp;
    
    // Emit trade event
    emit!(TradeEvent {
        trader: buyer.key(),
        token_mint: token_mint.key(),
        is_buy: true,
        sol_amount: net_sol_amount,
        token_amount: tokens_to_mint,
        virtual_sol_reserves: bonding_curve.virtual_sol_reserves,
        virtual_token_reserves: bonding_curve.virtual_token_reserves,
        real_sol_reserves: bonding_curve.real_sol_reserves,
        real_token_reserves: bonding_curve.real_token_reserves,
        timestamp: bonding_curve.last_trade_timestamp,
    });
    
    Ok(())
}

fn calculate_tokens_for_sol(
    sol_amount: u64,
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    _real_sol_reserves: u64,
    _real_token_reserves: u64,
) -> Result<u64> {
    // Using constant product formula: x * y = k
    // tokens_out = (token_reserves * sol_in) / (sol_reserves + sol_in)
    
    let numerator = (virtual_token_reserves as u128)
        .checked_mul(sol_amount as u128)
        .ok_or(PumpError::MathOverflow)?;
    
    let denominator = (virtual_sol_reserves as u128)
        .checked_add(sol_amount as u128)
        .ok_or(PumpError::MathOverflow)?;
    
    let tokens_out = numerator
        .checked_div(denominator)
        .ok_or(PumpError::MathOverflow)?;
    
    require!(tokens_out <= u64::MAX as u128, PumpError::MathOverflow);
    
    Ok(tokens_out as u64)
}

#[event]
pub struct TradeEvent {
    pub trader: Pubkey,
    pub token_mint: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub timestamp: i64,
}