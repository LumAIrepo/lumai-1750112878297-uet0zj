use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("PumpCLoneProgram11111111111111111111111111");

#[program]
pub mod pump_clone {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_basis_points: u16,
        initial_virtual_token_reserves: u64,
        initial_virtual_sol_reserves: u64,
    ) -> Result<()> {
        require!(fee_basis_points <= 1000, PumpError::InvalidFeeRate);
        require!(initial_virtual_token_reserves > 0, PumpError::InvalidReserves);
        require!(initial_virtual_sol_reserves > 0, PumpError::InvalidReserves);

        let platform_config = &mut ctx.accounts.platform_config;
        platform_config.authority = ctx.accounts.authority.key();
        platform_config.fee_basis_points = fee_basis_points;
        platform_config.initial_virtual_token_reserves = initial_virtual_token_reserves;
        platform_config.initial_virtual_sol_reserves = initial_virtual_sol_reserves;
        platform_config.total_tokens_created = 0;
        platform_config.total_volume = 0;
        platform_config.is_paused = false;

        Ok(())
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
        initial_supply: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.platform_config.is_paused, PumpError::PlatformPaused);
        require!(name.len() <= 32, PumpError::NameTooLong);
        require!(symbol.len() <= 10, PumpError::SymbolTooLong);
        require!(uri.len() <= 200, PumpError::UriTooLong);
        require!(initial_supply > 0, PumpError::InvalidSupply);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let platform_config = &mut ctx.accounts.platform_config;

        bonding_curve.mint = ctx.accounts.mint.key();
        bonding_curve.creator = ctx.accounts.creator.key();
        bonding_curve.name = name;
        bonding_curve.symbol = symbol;
        bonding_curve.uri = uri;
        bonding_curve.virtual_token_reserves = platform_config.initial_virtual_token_reserves;
        bonding_curve.virtual_sol_reserves = platform_config.initial_virtual_sol_reserves;
        bonding_curve.real_token_reserves = initial_supply;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.total_supply = initial_supply;
        bonding_curve.is_complete = false;
        bonding_curve.created_at = Clock::get()?.unix_timestamp;
        bonding_curve.bump = ctx.bumps.bonding_curve;

        platform_config.total_tokens_created = platform_config.total_tokens_created.checked_add(1).unwrap();

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding_curve",
                    ctx.accounts.mint.key().as_ref(),
                    &[bonding_curve.bump],
                ]],
            ),
            initial_supply,
        )?;

        emit!(TokenCreated {
            mint: ctx.accounts.mint.key(),
            creator: ctx.accounts.creator.key(),
            name: bonding_curve.name.clone(),
            symbol: bonding_curve.symbol.clone(),
            uri: bonding_curve.uri.clone(),
            initial_supply,
            timestamp: bonding_curve.created_at,
        });

        Ok(())
    }

    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.platform_config.is_paused, PumpError::PlatformPaused);
        require!(sol_amount > 0, PumpError::InvalidAmount);
        require!(!ctx.accounts.bonding_curve.is_complete, PumpError::BondingCurveComplete);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let platform_config = &ctx.accounts.platform_config;

        let fee_amount = sol_amount
            .checked_mul(platform_config.fee_basis_points as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let sol_amount_after_fee = sol_amount.checked_sub(fee_amount).unwrap();

        let tokens_out = calculate_tokens_out(
            sol_amount_after_fee,
            bonding_curve.virtual_sol_reserves,
            bonding_curve.virtual_token_reserves,
        )?;

        require!(tokens_out >= min_tokens_out, PumpError::SlippageExceeded);
        require!(tokens_out <= bonding_curve.real_token_reserves, PumpError::InsufficientTokens);

        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_add(sol_amount_after_fee)
            .unwrap();
        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_sub(tokens_out)
            .unwrap();
        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_sub(tokens_out)
            .unwrap();
        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_add(sol_amount_after_fee)
            .unwrap();

        let platform_config = &mut ctx.accounts.platform_config;
        platform_config.total_volume = platform_config.total_volume
            .checked_add(sol_amount)
            .unwrap();

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.bonding_curve.to_account_info(),
                },
            ),
            sol_amount_after_fee,
        )?;

        if fee_amount > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.platform_config.to_account_info(),
                    },
                ),
                fee_amount,
            )?;
        }

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                &[&[
                    b"bonding_curve",
                    ctx.accounts.mint.key().as_ref(),
                    &[bonding_curve.bump],
                ]],
            ),
            tokens_out,
        )?;

        emit!(TokensPurchased {
            mint: ctx.accounts.mint.key(),
            buyer: ctx.accounts.buyer.key(),
            sol_amount,
            tokens_out,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.platform_config.is_paused, PumpError::PlatformPaused);
        require!(token_amount > 0, PumpError::InvalidAmount);
        require!(!ctx.accounts.bonding_curve.is_complete, PumpError::BondingCurveComplete);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let platform_config = &ctx.accounts.platform_config;

        let sol_out = calculate_sol_out(
            token_amount,
            bonding_curve.virtual_token_reserves,
            bonding_curve.virtual_sol_reserves,
        )?;

        let fee_amount = sol_out
            .checked_mul(platform_config.fee_basis_points as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let sol_out_after_fee = sol_out.checked_sub(fee_amount).unwrap();

        require!(sol_out_after_fee >= min_sol_out, PumpError::SlippageExceeded);
        require!(sol_out <= bonding_curve.real_sol_reserves, PumpError::InsufficientSol);

        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_add(token_amount)
            .unwrap();
        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_sub(sol_out)
            .unwrap();
        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_add(token_amount)
            .unwrap();
        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_sub(sol_out)
            .unwrap();

        let platform_config = &mut ctx.accounts.platform_config;
        platform_config.total_volume = platform_config.total_volume
            .checked_add(sol_out)
            .unwrap();

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        **ctx.accounts.bonding_curve.to_account_info().try_borrow_mut_lamports()? -= sol_out_after_fee;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_out_after_fee;

        if fee_amount > 0 {
            **ctx.accounts.bonding_curve.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
            **ctx.accounts.platform_config.to_account_info().try_borrow_mut_lamports()? += fee_amount;
        }

        emit!(TokensSold {
            mint: ctx.accounts.mint.key(),
            seller: ctx.accounts.seller.key(),
            token_amount,
            sol_out: sol_out_after_fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn complete_bonding_curve(ctx: Context<CompleteBondingCurve>) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        require!(!bonding_curve.is_complete, PumpError::BondingCurveComplete);
        require!(
            bonding_curve.virtual_sol_reserves >= 85_000_000_000,
            PumpError::InsufficientLiquidity
        );

        bonding_curve.is_complete = true;

        emit!(BondingCurveCompleted {
            mint: ctx.accounts.mint.key(),
            final_sol_reserves: bonding_curve.real_sol_reserves,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn update_platform_config(
        ctx: Context<UpdatePlatformConfig>,
        fee_basis_points: Option<u16>,
        is_paused: Option<bool>,
    ) -> Result<()> {
        let platform_config = &mut ctx.accounts.platform_config;

        if let Some(fee) = fee_basis_points {
            require!(fee <= 1000, PumpError::InvalidFeeRate);
            platform_config.fee_basis_points = fee;
        }

        if let Some(paused) = is_paused {
            platform_config.is_paused = paused;
        }

        Ok(())
    }

    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        let platform_config = &ctx.accounts.platform_config;
        
        require!(
            amount <= platform_config.to_account_info().lamports(),
            PumpError::InsufficientFunds
        );

        **platform_config.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

fn calculate_tokens_out(
    sol_in: u64,
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
) -> Result<u64> {
    let numerator = sol_in
        .checked_mul(virtual_token_reserves)
        .ok_or(PumpError::MathOverflow)?;
    let denominator = virtual_sol_reserves
        .checked_add(sol_in)
        .ok_or(PumpError::MathOverflow)?;
    
    numerator
        .checked_div(denominator)
        .ok_or(PumpError::MathOverflow.into())
}

fn calculate_sol_out(
    tokens_in: u64,
    virtual_token_reserves: u64,
    virtual_sol_reserves: u64,
) -> Result<u64> {
    let numerator = tokens_in
        .checked_mul(virtual_sol_reserves)
        .ok_or(PumpError::MathOverflow)?;
    let denominator = virtual_token_reserves
        .checked_add(tokens_in)
        .ok_or(PumpError::MathOverflow)?;
    
    numerator
        .checked_div(denominator)
        .ok_or(PumpError::MathOverflow.into())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [b"platform_config"],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct