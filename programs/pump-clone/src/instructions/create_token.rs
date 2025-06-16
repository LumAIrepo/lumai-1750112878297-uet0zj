use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    constants::*,
    errors::PumpError,
    state::{BondingCurve, GlobalConfig},
    utils::*,
};

#[derive(Accounts)]
#[instruction(params: CreateTokenParams)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [GLOBAL_CONFIG_SEED],
        bump,
        has_one = fee_recipient
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = BondingCurve::LEN,
        seeds = [BONDING_CURVE_SEED, mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: fee recipient from global config
    #[account(mut)]
    pub fee_recipient: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub initial_virtual_token_reserves: u64,
    pub initial_virtual_sol_reserves: u64,
    pub initial_real_token_reserves: u64,
}

impl<'info> CreateToken<'info> {
    pub fn validate(&self, params: &CreateTokenParams) -> Result<()> {
        // Validate token name
        require!(
            !params.name.is_empty() && params.name.len() <= MAX_NAME_LENGTH,
            PumpError::InvalidTokenName
        );

        // Validate token symbol
        require!(
            !params.symbol.is_empty() && params.symbol.len() <= MAX_SYMBOL_LENGTH,
            PumpError::InvalidTokenSymbol
        );

        // Validate URI
        require!(
            !params.uri.is_empty() && params.uri.len() <= MAX_URI_LENGTH,
            PumpError::InvalidTokenUri
        );

        // Validate bonding curve parameters
        require!(
            params.initial_virtual_token_reserves > 0,
            PumpError::InvalidVirtualTokenReserves
        );

        require!(
            params.initial_virtual_sol_reserves > 0,
            PumpError::InvalidVirtualSolReserves
        );

        require!(
            params.initial_real_token_reserves > 0,
            PumpError::InvalidRealTokenReserves
        );

        // Ensure initial real token reserves don't exceed total supply
        require!(
            params.initial_real_token_reserves <= TOTAL_SUPPLY,
            PumpError::ExceedsTotalSupply
        );

        // Validate bonding curve math
        let k = params
            .initial_virtual_token_reserves
            .checked_mul(params.initial_virtual_sol_reserves)
            .ok_or(PumpError::MathOverflow)?;

        require!(k > 0, PumpError::InvalidBondingCurveParameters);

        Ok(())
    }

    pub fn create_token_metadata(&self, params: &CreateTokenParams) -> Result<()> {
        let metadata_ctx = CpiContext::new(
            self.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: self.metadata.to_account_info(),
                mint: self.mint.to_account_info(),
                mint_authority: self.bonding_curve.to_account_info(),
                update_authority: self.bonding_curve.to_account_info(),
                payer: self.creator.to_account_info(),
                system_program: self.system_program.to_account_info(),
                rent: self.rent.to_account_info(),
            },
        );

        let bonding_curve_bump = ctx.bumps.bonding_curve;
        let mint_key = self.mint.key();
        let seeds = &[
            BONDING_CURVE_SEED,
            mint_key.as_ref(),
            &[bonding_curve_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let data_v2 = DataV2 {
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            uri: params.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx.with_signer(signer_seeds),
            data_v2,
            false,
            true,
            None,
        )?;

        Ok(())
    }

    pub fn mint_initial_tokens(&self, params: &CreateTokenParams) -> Result<()> {
        let mint_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.mint.to_account_info(),
                to: self.bonding_curve_token_account.to_account_info(),
                authority: self.bonding_curve.to_account_info(),
            },
        );

        let bonding_curve_bump = ctx.bumps.bonding_curve;
        let mint_key = self.mint.key();
        let seeds = &[
            BONDING_CURVE_SEED,
            mint_key.as_ref(),
            &[bonding_curve_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        mint_to(
            mint_ctx.with_signer(signer_seeds),
            params.initial_real_token_reserves,
        )?;

        Ok(())
    }

    pub fn initialize_bonding_curve(&mut self, params: &CreateTokenParams) -> Result<()> {
        let clock = Clock::get()?;
        
        self.bonding_curve.set_inner(BondingCurve {
            mint: self.mint.key(),
            creator: self.creator.key(),
            virtual_token_reserves: params.initial_virtual_token_reserves,
            virtual_sol_reserves: params.initial_virtual_sol_reserves,
            real_token_reserves: params.initial_real_token_reserves,
            real_sol_reserves: 0,
            token_total_supply: TOTAL_SUPPLY,
            complete: false,
            created_at: clock.unix_timestamp,
            bump: ctx.bumps.bonding_curve,
        });

        Ok(())
    }

    pub fn transfer_creation_fee(&self) -> Result<()> {
        let creation_fee = self.global_config.token_creation_fee;
        
        if creation_fee > 0 {
            let transfer_instruction = anchor_lang::system_program::Transfer {
                from: self.creator.to_account_info(),
                to: self.fee_recipient.to_account_info(),
            };

            let cpi_ctx = CpiContext::new(
                self.system_program.to_account_info(),
                transfer_instruction,
            );

            anchor_lang::system_program::transfer(cpi_ctx, creation_fee)?;
        }

        Ok(())
    }
}

pub fn handler(ctx: Context<CreateToken>, params: CreateTokenParams) -> Result<()> {
    let create_token = &mut ctx.accounts;

    // Validate input parameters
    create_token.validate(&params)?;

    // Transfer creation fee
    create_token.transfer_creation_fee()?;

    // Create token metadata
    create_token.create_token_metadata(&params)?;

    // Mint initial tokens to bonding curve
    create_token.mint_initial_tokens(&params)?;

    // Initialize bonding curve state
    create_token.initialize_bonding_curve(&params)?;

    // Emit token creation event
    emit!(TokenCreated {
        mint: create_token.mint.key(),
        creator: create_token.creator.key(),
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        bonding_curve: create_token.bonding_curve.key(),
        virtual_token_reserves: params.initial_virtual_token_reserves,
        virtual_sol_reserves: params.initial_virtual_sol_reserves,
        real_token_reserves: params.initial_real_token_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Token created successfully: mint={}, creator={}, bonding_curve={}",
        create_token.mint.key(),
        create_token.creator.key(),
        create_token.bonding_curve.key()
    );

    Ok(())
}

#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub bonding_curve: Pubkey,
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub timestamp: i64,
}