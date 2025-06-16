use anchor_lang::prelude::*;

#[account]
pub struct GlobalState {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub platform_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub migration_fee: u64,
    pub min_sol_threshold: u64,
    pub max_sol_threshold: u64,
    pub initial_virtual_token_reserves: u64,
    pub initial_virtual_sol_reserves: u64,
    pub initial_real_token_reserves: u64,
    pub paused: bool,
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // fee_recipient
        2 + // platform_fee_bps
        2 + // creator_fee_bps
        8 + // migration_fee
        8 + // min_sol_threshold
        8 + // max_sol_threshold
        8 + // initial_virtual_token_reserves
        8 + // initial_virtual_sol_reserves
        8 + // initial_real_token_reserves
        1 + // paused
        1; // bump
}

#[account]
pub struct BondingCurve {
    pub virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub token_total_supply: u64,
    pub complete: bool,
    pub bump: u8,
}

impl BondingCurve {
    pub const LEN: usize = 8 + // discriminator
        8 + // virtual_token_reserves
        8 + // virtual_sol_reserves
        8 + // real_token_reserves
        8 + // real_sol_reserves
        8 + // token_total_supply
        1 + // complete
        1; // bump

    pub fn calculate_buy_price(&self, token_amount: u64) -> Result<u64> {
        if self.complete {
            return Err(error!(ErrorCode::BondingCurveComplete));
        }

        if token_amount == 0 {
            return Ok(0);
        }

        let virtual_token_reserves = self.virtual_token_reserves;
        let virtual_sol_reserves = self.virtual_sol_reserves;

        if virtual_token_reserves <= token_amount {
            return Err(error!(ErrorCode::InsufficientTokenReserves));
        }

        // Calculate SOL amount using constant product formula: x * y = k
        let k = virtual_token_reserves
            .checked_mul(virtual_sol_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        let new_token_reserves = virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        let new_sol_reserves = k
            .checked_div(new_token_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        let sol_amount = new_sol_reserves
            .checked_sub(virtual_sol_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(sol_amount)
    }

    pub fn calculate_sell_price(&self, token_amount: u64) -> Result<u64> {
        if self.complete {
            return Err(error!(ErrorCode::BondingCurveComplete));
        }

        if token_amount == 0 {
            return Ok(0);
        }

        let virtual_token_reserves = self.virtual_token_reserves;
        let virtual_sol_reserves = self.virtual_sol_reserves;

        // Calculate SOL amount using constant product formula: x * y = k
        let k = virtual_token_reserves
            .checked_mul(virtual_sol_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        let new_token_reserves = virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        let new_sol_reserves = k
            .checked_div(new_token_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        let sol_amount = virtual_sol_reserves
            .checked_sub(new_sol_reserves)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(sol_amount)
    }

    pub fn update_reserves_buy(&mut self, token_amount: u64, sol_amount: u64) -> Result<()> {
        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn update_reserves_sell(&mut self, token_amount: u64, sol_amount: u64) -> Result<()> {
        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }
}

#[account]
pub struct TokenMetadata {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub image_uri: String,
    pub metadata_uri: String,
    pub twitter: String,
    pub telegram: String,
    pub website: String,
    pub created_at: i64,
    pub market_cap: u64,
    pub reply_count: u32,
    pub king_of_hill_timestamp: i64,
    pub nsfw: bool,
    pub show_name: bool,
    pub bump: u8,
}

impl TokenMetadata {
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_SYMBOL_LEN: usize = 10;
    pub const MAX_DESCRIPTION_LEN: usize = 500;
    pub const MAX_URI_LEN: usize = 200;
    pub const MAX_SOCIAL_LEN: usize = 100;

    pub const LEN: usize = 8 + // discriminator
        32 + // mint
        32 + // creator
        4 + Self::MAX_NAME_LEN + // name
        4 + Self::MAX_SYMBOL_LEN + // symbol
        4 + Self::MAX_DESCRIPTION_LEN + // description
        4 + Self::MAX_URI_LEN + // image_uri
        4 + Self::MAX_URI_LEN + // metadata_uri
        4 + Self::MAX_SOCIAL_LEN + // twitter
        4 + Self::MAX_SOCIAL_LEN + // telegram
        4 + Self::MAX_SOCIAL_LEN + // website
        8 + // created_at
        8 + // market_cap
        4 + // reply_count
        8 + // king_of_hill_timestamp
        1 + // nsfw
        1 + // show_name
        1; // bump

    pub fn validate_metadata(&self) -> Result<()> {
        require!(
            self.name.len() <= Self::MAX_NAME_LEN && !self.name.is_empty(),
            ErrorCode::InvalidTokenName
        );

        require!(
            self.symbol.len() <= Self::MAX_SYMBOL_LEN && !self.symbol.is_empty(),
            ErrorCode::InvalidTokenSymbol
        );

        require!(
            self.description.len() <= Self::MAX_DESCRIPTION_LEN,
            ErrorCode::InvalidTokenDescription
        );

        require!(
            self.image_uri.len() <= Self::MAX_URI_LEN,
            ErrorCode::InvalidImageUri
        );

        require!(
            self.metadata_uri.len() <= Self::MAX_URI_LEN,
            ErrorCode::InvalidMetadataUri
        );

        require!(
            self.twitter.len() <= Self::MAX_SOCIAL_LEN,
            ErrorCode::InvalidSocialLink
        );

        require!(
            self.telegram.len() <= Self::MAX_SOCIAL_LEN,
            ErrorCode::InvalidSocialLink
        );

        require!(
            self.website.len() <= Self::MAX_SOCIAL_LEN,
            ErrorCode::InvalidSocialLink
        );

        Ok(())
    }
}

#[account]
pub struct UserStats {
    pub user: Pubkey,
    pub tokens_created: u32,
    pub total_volume_traded: u64,
    pub total_fees_paid: u64,
    pub total_tokens_bought: u64,
    pub total_tokens_sold: u64,
    pub total_sol_spent: u64,
    pub total_sol_received: u64,
    pub first_trade_timestamp: i64,
    pub last_trade_timestamp: i64,
    pub bump: u8,
}

impl UserStats {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        4 + // tokens_created
        8 + // total_volume_traded
        8 + // total_fees_paid
        8 + // total_tokens_bought
        8 + // total_tokens_sold
        8 + // total_sol_spent
        8 + // total_sol_received
        8 + // first_trade_timestamp
        8 + // last_trade_timestamp
        1; // bump

    pub fn update_buy_stats(&mut self, token_amount: u64, sol_amount: u64, fees: u64, timestamp: i64) -> Result<()> {
        self.total_tokens_bought = self.total_tokens_bought
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_sol_spent = self.total_sol_spent
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_volume_traded = self.total_volume_traded
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_fees_paid = self.total_fees_paid
            .checked_add(fees)
            .ok_or(ErrorCode::MathOverflow)?;

        if self.first_trade_timestamp == 0 {
            self.first_trade_timestamp = timestamp;
        }
        self.last_trade_timestamp = timestamp;

        Ok(())
    }

    pub fn update_sell_stats(&mut self, token_amount: u64, sol_amount: u64, fees: u64, timestamp: i64) -> Result<()> {
        self.total_tokens_sold = self.total_tokens_sold
            .checked_add(token_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_sol_received = self.total_sol_received
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_volume_traded = self.total_volume_traded
            .checked_add(sol_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        self.total_fees_paid = self.total_fees_paid
            .checked_add(fees)
            .ok_or(ErrorCode::MathOverflow)?;

        if self.first_trade_timestamp == 0 {
            self.first_trade_timestamp = timestamp;
        }
        self.last_trade_timestamp = timestamp;

        Ok(())
    }
}

#[account]
pub struct TradeHistory {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub is_buy: bool,
    pub token_amount: u64,
    pub sol_amount: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub timestamp: i64,
    pub signature: String,
    pub bump: u8,
}

impl TradeHistory {
    pub const MAX_SIGNATURE_LEN: usize = 88;

    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // mint
        1 + // is_buy
        8 + // token_amount
        8 + // sol_amount
        8 + // virtual_sol_reserves
        8 + // virtual_token_reserves
        8 + // timestamp
        4 + Self::MAX_SIGNATURE_LEN + // signature
        1; // bump
}

#[account]
pub struct Comment {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub content: String,
    pub timestamp: i64,
    pub reply_to: Option<Pubkey>,
    pub likes: u32,
    pub replies: u32,
    pub bump: u8,
}

impl Comment {
    pub const MAX_CONTENT_LEN: usize = 280;

    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // mint
        4 + Self::MAX_CONTENT_LEN + // content
        8 + // timestamp
        1 + 32 + // reply_to (Option<Pubkey>)
        4 + // likes
        4 + // replies
        1; // bump

    pub fn validate_content(&self) -> Result<()> {
        require!(
            !self.content.is_empty() && self.content.len() <= Self::MAX_CONTENT_LEN,
            ErrorCode::InvalidCommentContent
        );
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bonding curve is complete")]
    BondingCurveComplete,
    #[msg("Insufficient token reserves")]
    InsufficientTokenReserves,
    #[msg("Invalid token name")]
    InvalidTokenName,
    #[msg("Invalid token symbol")]
    InvalidTokenSymbol,
    #[msg("Invalid token description")]
    InvalidTokenDescription,
    #[msg("Invalid image URI")]
    InvalidImageUri,
    #[msg("Invalid metadata URI")]
    InvalidMetadataUri,
    #[msg("Invalid social link")]
    InvalidSocialLink,
    #[msg("Invalid comment content")]
    InvalidCommentContent,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient SOL balance")]
    InsufficientSolBalance,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Program is paused")]
    ProgramPaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid fee percentage")]
    InvalidFeePercentage,
    #[msg("Migration threshold not met")]
    MigrationThresholdNotMet,
    #[msg("Token already migrated")]
    TokenAlreadyMigrated,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Market cap too low")]
    MarketCapTooLow,
    #[msg("Market cap too high")]