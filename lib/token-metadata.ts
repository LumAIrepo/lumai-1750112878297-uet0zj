import { Connection, PublicKey } from '@solana/web3.js'
import { Metaplex, bundlrStorage, keypairIdentity } from '@metaplex-foundation/js'
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata'

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  external_url?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  properties?: {
    files?: Array<{
      uri: string
      type: string
    }>
    category?: string
  }
  collection?: {
    name: string
    family: string
  }
}

export interface CreateTokenMetadataParams {
  name: string
  symbol: string
  description: string
  imageFile: File
  externalUrl?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  collection?: {
    name: string
    family: string
  }
}

export class TokenMetadataService {
  private metaplex: Metaplex
  private connection: Connection

  constructor(connection: Connection, keypair?: any) {
    this.connection = connection
    this.metaplex = Metaplex.make(connection)
      .use(bundlrStorage({
        address: process.env.NEXT_PUBLIC_BUNDLR_ADDRESS || 'https://devnet.bundlr.network',
        providerUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
        timeout: 60000,
      }))

    if (keypair) {
      this.metaplex.use(keypairIdentity(keypair))
    }
  }

  async uploadImage(imageFile: File): Promise<string> {
    try {
      if (!imageFile) {
        throw new Error('Image file is required')
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Invalid image type. Supported types: JPEG, PNG, GIF, WebP')
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024
      if (imageFile.size > maxSize) {
        throw new Error('Image file too large. Maximum size is 10MB')
      }

      const buffer = await imageFile.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)

      const imageUri = await this.metaplex.storage().upload(uint8Array)
      
      if (!imageUri) {
        throw new Error('Failed to upload image to IPFS')
      }

      return imageUri
    } catch (error) {
      console.error('Error uploading image:', error)
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createMetadata(params: CreateTokenMetadataParams): Promise<string> {
    try {
      // Validate required parameters
      if (!params.name || params.name.trim().length === 0) {
        throw new Error('Token name is required')
      }

      if (!params.symbol || params.symbol.trim().length === 0) {
        throw new Error('Token symbol is required')
      }

      if (!params.description || params.description.trim().length === 0) {
        throw new Error('Token description is required')
      }

      if (!params.imageFile) {
        throw new Error('Image file is required')
      }

      // Validate name length
      if (params.name.length > 32) {
        throw new Error('Token name must be 32 characters or less')
      }

      // Validate symbol length and format
      if (params.symbol.length > 10) {
        throw new Error('Token symbol must be 10 characters or less')
      }

      if (!/^[A-Z0-9]+$/.test(params.symbol)) {
        throw new Error('Token symbol must contain only uppercase letters and numbers')
      }

      // Validate description length
      if (params.description.length > 1000) {
        throw new Error('Token description must be 1000 characters or less')
      }

      // Upload image first
      const imageUri = await this.uploadImage(params.imageFile)

      // Create metadata object
      const metadata: TokenMetadata = {
        name: params.name.trim(),
        symbol: params.symbol.trim().toUpperCase(),
        description: params.description.trim(),
        image: imageUri,
        external_url: params.externalUrl?.trim() || undefined,
        attributes: params.attributes || [],
        properties: {
          files: [
            {
              uri: imageUri,
              type: params.imageFile.type,
            },
          ],
          category: 'image',
        },
        collection: params.collection || undefined,
      }

      // Upload metadata to IPFS
      const metadataUri = await this.metaplex.nfts().uploadMetadata(metadata)

      if (!metadataUri) {
        throw new Error('Failed to upload metadata to IPFS')
      }

      return metadataUri
    } catch (error) {
      console.error('Error creating metadata:', error)
      throw new Error(`Failed to create metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async fetchMetadata(uri: string): Promise<TokenMetadata | null> {
    try {
      if (!uri) {
        throw new Error('Metadata URI is required')
      }

      const response = await fetch(uri)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`)
      }

      const metadata = await response.json()
      
      // Validate metadata structure
      if (!metadata.name || !metadata.symbol || !metadata.image) {
        throw new Error('Invalid metadata structure')
      }

      return metadata as TokenMetadata
    } catch (error) {
      console.error('Error fetching metadata:', error)
      return null
    }
  }

  async validateMetadata(metadata: TokenMetadata): Promise<boolean> {
    try {
      // Check required fields
      if (!metadata.name || !metadata.symbol || !metadata.description || !metadata.image) {
        return false
      }

      // Validate field lengths
      if (metadata.name.length > 32 || metadata.symbol.length > 10 || metadata.description.length > 1000) {
        return false
      }

      // Validate symbol format
      if (!/^[A-Z0-9]+$/.test(metadata.symbol)) {
        return false
      }

      // Validate image URL
      try {
        new URL(metadata.image)
      } catch {
        return false
      }

      // Validate external URL if provided
      if (metadata.external_url) {
        try {
          new URL(metadata.external_url)
        } catch {
          return false
        }
      }

      // Validate attributes if provided
      if (metadata.attributes) {
        for (const attr of metadata.attributes) {
          if (!attr.trait_type || attr.value === undefined || attr.value === null) {
            return false
          }
        }
      }

      return true
    } catch (error) {
      console.error('Error validating metadata:', error)
      return false
    }
  }

  async getTokenMetadataFromMint(mintAddress: string): Promise<TokenMetadata | null> {
    try {
      const mintPublicKey = new PublicKey(mintAddress)
      
      const nft = await this.metaplex.nfts().findByMint({
        mintAddress: mintPublicKey,
      })

      if (!nft.uri) {
        return null
      }

      return await this.fetchMetadata(nft.uri)
    } catch (error) {
      console.error('Error getting token metadata from mint:', error)
      return null
    }
  }

  async updateMetadata(params: CreateTokenMetadataParams & { mintAddress: string }): Promise<string> {
    try {
      const mintPublicKey = new PublicKey(params.mintAddress)
      
      // Create new metadata
      const metadataUri = await this.createMetadata(params)

      // Update the token metadata
      await this.metaplex.nfts().update({
        nftOrSft: { address: mintPublicKey, tokenStandard: TokenStandard.Fungible },
        uri: metadataUri,
      })

      return metadataUri
    } catch (error) {
      console.error('Error updating metadata:', error)
      throw new Error(`Failed to update metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static generateDefaultAttributes(tokenData: {
    totalSupply: number
    decimals: number
    createdAt: Date
    creator: string
  }): Array<{ trait_type: string; value: string | number }> {
    return [
      {
        trait_type: 'Total Supply',
        value: tokenData.totalSupply.toLocaleString(),
      },
      {
        trait_type: 'Decimals',
        value: tokenData.decimals,
      },
      {
        trait_type: 'Created',
        value: tokenData.createdAt.toISOString().split('T')[0],
      },
      {
        trait_type: 'Creator',
        value: tokenData.creator.slice(0, 8) + '...',
      },
      {
        trait_type: 'Platform',
        value: 'PumpClone',
      },
    ]
  }

  static sanitizeMetadataInput(input: string): string {
    return input
      .trim()
      .replace(/[^\w\s\-_.!@#$%^&*()+={}[\]:";'<>?,./]/g, '')
      .slice(0, 1000)
  }

  static validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid image type. Supported types: JPEG, PNG, GIF, WebP',
      }
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'Image file too large. Maximum size is 10MB',
      }
    }

    return { valid: true }
  }
}

export const createTokenMetadataService = (connection: Connection, keypair?: any) => {
  return new TokenMetadataService(connection, keypair)
}