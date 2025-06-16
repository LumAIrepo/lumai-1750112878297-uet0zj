use anchor_lang::prelude::*;

#[error_code]
pub enum PumpCloneError {
    #[msg("Insufficient funds for token creation")]
    InsufficientFunds,
    
    #[msg("Token name is too long (max 32 characters)")]
    TokenNameTooLong,
    
    #[msg("Token symbol is too long (max 10 characters)")]
    TokenSymbolTooLong,
    
    #[msg("Token description is too long (max 200 characters)")]
    TokenDescriptionTooLong,
    
    #[msg("Invalid token metadata URI")]
    InvalidMetadataUri,
    
    #[msg("Token supply must be greater than zero")]
    InvalidTokenSupply,
    
    #[msg("Bonding curve parameters are invalid")]
    InvalidBondingCurveParams,
    
    #[msg("Insufficient SOL for purchase")]
    InsufficientSolForPurchase,
    
    #[msg("Insufficient tokens for sale")]
    InsufficientTokensForSale,
    
    #[msg("Purchase amount must be greater than zero")]
    InvalidPurchaseAmount,
    
    #[msg("Sale amount must be greater than zero")]
    InvalidSaleAmount,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,
    
    #[msg("Token launch has not started yet")]
    LaunchNotStarted,
    
    #[msg("Token launch has already ended")]
    LaunchEnded,
    
    #[msg("Maximum token supply reached")]
    MaxSupplyReached,
    
    #[msg("Minimum purchase amount not met")]
    MinPurchaseAmountNotMet,
    
    #[msg("Maximum purchase amount exceeded")]
    MaxPurchaseAmountExceeded,
    
    #[msg("Trading is currently paused")]
    TradingPaused,
    
    #[msg("Unauthorized access - only creator allowed")]
    UnauthorizedCreator,
    
    #[msg("Unauthorized access - only admin allowed")]
    UnauthorizedAdmin,
    
    #[msg("Token is already graduated to Raydium")]
    TokenAlreadyGraduated,
    
    #[msg("Token has not reached graduation threshold")]
    GraduationThresholdNotMet,
    
    #[msg("Invalid fee recipient account")]
    InvalidFeeRecipient,
    
    #[msg("Fee percentage is too high (max 10%)")]
    FeeTooHigh,
    
    #[msg("Invalid price calculation")]
    InvalidPriceCalculation,
    
    #[msg("Arithmetic overflow in calculation")]
    ArithmeticOverflow,
    
    #[msg("Arithmetic underflow in calculation")]
    ArithmeticUnderflow,
    
    #[msg("Division by zero error")]
    DivisionByZero,
    
    #[msg("Invalid account provided")]
    InvalidAccount,
    
    #[msg("Account already initialized")]
    AccountAlreadyInitialized,
    
    #[msg("Account not initialized")]
    AccountNotInitialized,
    
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Token account has insufficient balance")]
    InsufficientTokenBalance,
    
    #[msg("Invalid associated token account")]
    InvalidAssociatedTokenAccount,
    
    #[msg("Token program mismatch")]
    TokenProgramMismatch,
    
    #[msg("System program mismatch")]
    SystemProgramMismatch,
    
    #[msg("Associated token program mismatch")]
    AssociatedTokenProgramMismatch,
    
    #[msg("Rent program mismatch")]
    RentProgramMismatch,
    
    #[msg("Invalid program ID")]
    InvalidProgramId,
    
    #[msg("Invalid instruction data")]
    InvalidInstructionData,
    
    #[msg("Instruction data too short")]
    InstructionDataTooShort,
    
    #[msg("Invalid discriminator")]
    InvalidDiscriminator,
    
    #[msg("Serialization error")]
    SerializationError,
    
    #[msg("Deserialization error")]
    DeserializationError,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("Launch duration too short (minimum 1 hour)")]
    LaunchDurationTooShort,
    
    #[msg("Launch duration too long (maximum 30 days)")]
    LaunchDurationTooLong,
    
    #[msg("Invalid bonding curve type")]
    InvalidBondingCurveType,
    
    #[msg("Reserve ratio out of bounds (1-100%)")]
    InvalidReserveRatio,
    
    #[msg("Virtual SOL reserves must be positive")]
    InvalidVirtualSolReserves,
    
    #[msg("Virtual token reserves must be positive")]
    InvalidVirtualTokenReserves,
    
    #[msg("Real SOL reserves cannot exceed virtual reserves")]
    InvalidRealSolReserves,
    
    #[msg("Real token reserves cannot exceed virtual reserves")]
    InvalidRealTokenReserves,
    
    #[msg("Liquidity pool creation failed")]
    LiquidityPoolCreationFailed,
    
    #[msg("Migration to Raydium failed")]
    RaydiumMigrationFailed,
    
    #[msg("Invalid migration parameters")]
    InvalidMigrationParams,
    
    #[msg("Graduation market cap not reached")]
    GraduationMarketCapNotReached,
    
    #[msg("Invalid market cap calculation")]
    InvalidMarketCapCalculation,
    
    #[msg("Token creation fee not paid")]
    TokenCreationFeeNotPaid,
    
    #[msg("Trading fee not paid")]
    TradingFeeNotPaid,
    
    #[msg("Graduation fee not paid")]
    GraduationFeeNotPaid,
    
    #[msg("Invalid fee calculation")]
    InvalidFeeCalculation,
    
    #[msg("Fee collection failed")]
    FeeCollectionFailed,
    
    #[msg("Invalid referral account")]
    InvalidReferralAccount,
    
    #[msg("Referral reward calculation failed")]
    ReferralRewardCalculationFailed,
    
    #[msg("Maximum referral reward exceeded")]
    MaxReferralRewardExceeded,
    
    #[msg("Self-referral not allowed")]
    SelfReferralNotAllowed,
    
    #[msg("Invalid social media links")]
    InvalidSocialMediaLinks,
    
    #[msg("Token image upload failed")]
    TokenImageUploadFailed,
    
    #[msg("Invalid image format (only PNG, JPG, GIF allowed)")]
    InvalidImageFormat,
    
    #[msg("Image file too large (max 5MB)")]
    ImageFileTooLarge,
    
    #[msg("Metadata update failed")]
    MetadataUpdateFailed,
    
    #[msg("Invalid metadata format")]
    InvalidMetadataFormat,
    
    #[msg("Metadata storage failed")]
    MetadataStorageFailed,
    
    #[msg("IPFS upload failed")]
    IpfsUploadFailed,
    
    #[msg("Invalid IPFS hash")]
    InvalidIpfsHash,
    
    #[msg("Token holder limit exceeded")]
    TokenHolderLimitExceeded,
    
    #[msg("Anti-bot protection triggered")]
    AntiBotProtectionTriggered,
    
    #[msg("Transaction rate limit exceeded")]
    TransactionRateLimitExceeded,
    
    #[msg("Wallet blacklisted")]
    WalletBlacklisted,
    
    #[msg("Token trading suspended")]
    TokenTradingSuspended,
    
    #[msg("Emergency pause activated")]
    EmergencyPauseActivated,
    
    #[msg("Contract upgrade in progress")]
    ContractUpgradeInProgress,
    
    #[msg("Maintenance mode active")]
    MaintenanceModeActive,
    
    #[msg("Invalid configuration parameters")]
    InvalidConfigurationParams,
    
    #[msg("Configuration update failed")]
    ConfigurationUpdateFailed,
    
    #[msg("Access control violation")]
    AccessControlViolation,
    
    #[msg("Invalid signature")]
    InvalidSignature,
    
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    
    #[msg("Nonce already used")]
    NonceAlreadyUsed,
    
    #[msg("Invalid nonce")]
    InvalidNonce,
    
    #[msg("Transaction expired")]
    TransactionExpired,
    
    #[msg("Invalid transaction hash")]
    InvalidTransactionHash,
    
    #[msg("Duplicate transaction")]
    DuplicateTransaction,
    
    #[msg("Transaction replay attack detected")]
    TransactionReplayAttack,
    
    #[msg("Invalid block hash")]
    InvalidBlockHash,
    
    #[msg("Block confirmation timeout")]
    BlockConfirmationTimeout,
    
    #[msg("Network congestion detected")]
    NetworkCongestion,
    
    #[msg("RPC endpoint unavailable")]
    RpcEndpointUnavailable,
    
    #[msg("Oracle price feed unavailable")]
    OraclePriceFeedUnavailable,
    
    #[msg("Price data stale")]
    PriceDataStale,
    
    #[msg("Invalid price feed")]
    InvalidPriceFeed,
    
    #[msg("Price manipulation detected")]
    PriceManipulationDetected,
    
    #[msg("Liquidity too low for trade")]
    LiquidityTooLow,
    
    #[msg("Market impact too high")]
    MarketImpactTooHigh,
    
    #[msg("Front-running protection triggered")]
    FrontRunningProtection,
    
    #[msg("MEV protection active")]
    MevProtectionActive,
    
    #[msg("Sandwich attack detected")]
    SandwichAttackDetected,
    
    #[msg("Flash loan attack detected")]
    FlashLoanAttackDetected,
    
    #[msg("Governance proposal not found")]
    GovernanceProposalNotFound,
    
    #[msg("Governance voting period ended")]
    GovernanceVotingPeriodEnded,
    
    #[msg("Insufficient governance tokens for voting")]
    InsufficientGovernanceTokens,
    
    #[msg("Already voted on this proposal")]
    AlreadyVotedOnProposal,
    
    #[msg("Governance proposal execution failed")]
    GovernanceProposalExecutionFailed,
    
    #[msg("Invalid governance parameters")]
    InvalidGovernanceParams,
    
    #[msg("Quorum not reached")]
    QuorumNotReached,
    
    #[msg("Proposal threshold not met")]
    ProposalThresholdNotMet,
    
    #[msg("Timelock period not elapsed")]
    TimelockPeriodNotElapsed,
    
    #[msg("Emergency shutdown initiated")]
    EmergencyShutdownInitiated,
    
    #[msg("Circuit breaker triggered")]
    CircuitBreakerTriggered,
    
    #[msg("Risk management limits exceeded")]
    RiskManagementLimitsExceeded,
    
    #[msg("Compliance check failed")]
    ComplianceCheckFailed,
    
    #[msg("KYC verification required")]
    KycVerificationRequired,
    
    #[msg("Geographic restriction applied")]
    GeographicRestriction,
    
    #[msg("Regulatory compliance violation")]
    RegulatoryComplianceViolation,
    
    #[msg("Audit trail generation failed")]
    AuditTrailGenerationFailed,
    
    #[msg("Data integrity check failed")]
    DataIntegrityCheckFailed,
    
    #[msg("Backup creation failed")]
    BackupCreationFailed,
    
    #[msg("Recovery process failed")]
    RecoveryProcessFailed,
    
    #[msg("State synchronization error")]
    StateSynchronizationError,
    
    #[msg("Cross-chain bridge error")]
    CrossChainBridgeError,
    
    #[msg("Multi-signature threshold not met")]
    MultiSigThresholdNotMet,
    
    #[msg("Invalid multi-signature configuration")]
    InvalidMultiSigConfig,
    
    #[msg("Hardware wallet connection failed")]
    HardwareWalletConnectionFailed,
    
    #[msg("Cold storage access denied")]
    ColdStorageAccessDenied,
    
    #[msg("Hot wallet security breach detected")]
    HotWalletSecurityBreach,
    
    #[msg("Encryption key rotation required")]
    EncryptionKeyRotationRequired,
    
    #[msg("Security audit required")]
    SecurityAuditRequired,
    
    #[msg("Penetration test failed")]
    PenetrationTestFailed,
    
    #[msg("Vulnerability scan detected issues")]
    VulnerabilityScanDetectedIssues,
    
    #[msg("Security patch required")]
    SecurityPatchRequired,
    
    #[msg("Incident response activated")]
    IncidentResponseActivated,
    
    #[msg("Forensic analysis in progress")]
    ForensicAnalysisInProgress,
    
    #[msg("Legal hold applied")]
    LegalHoldApplied,
    
    #[msg("Regulatory reporting required")]
    RegulatoryReportingRequired,
    
    #[msg("Tax calculation error")]
    TaxCalculationError,
    
    #[msg("Financial reporting error")]
    FinancialReportingError,
    
    #[msg("Accounting reconciliation failed")]
    AccountingReconciliationFailed,
    
    #[msg("Budget allocation exceeded")]
    BudgetAllocationExceeded,
    
    #[msg("Cost center validation failed")]
    CostCenterValidationFailed,
    
    #[msg("Revenue recognition error")]
    RevenueRecognitionError,
    
    #[msg("Profit and loss calculation error")]
    ProfitLossCalculationError,
    
    #[msg("Cash flow projection error")]
    CashFlowProjectionError,
    
    #[msg("Risk assessment failed")]
    RiskAssessmentFailed,
    
    #[msg("Stress test failed")]
    StressTestFailed,
    
    #[msg("Scenario analysis incomplete")]
    ScenarioAnalysisIncomplete,
    
    #[msg("Monte Carlo simulation error")]
    MonteCarloSimulationError,
    
    #[msg("Backtesting validation failed")]
    BacktestingValidationFailed,
    
    #[msg("Performance benchmark not met")]
    PerformanceBenchmarkNotMet,
    
    #[msg("SLA violation detected")]
    SlaViolationDetected,
    
    #[msg("Uptime requirement not met")]
    UptimeRequirementNotMet,
    
    #[msg("Response time exceeded")]
    ResponseTimeExceeded,
    
    #[msg("Throughput capacity exceeded")]
    ThroughputCapacityExceeded,
    
    #[msg("Memory allocation failed")]
    MemoryAllocationFailed,
    
    #[msg("CPU utilization too high")]
    CpuUtilizationTooHigh,
    
    #[msg("Disk space insufficient")]
    DiskSpaceInsufficient,
    
    #[msg("Network bandwidth exceeded")]
    NetworkBandwidthExceeded,