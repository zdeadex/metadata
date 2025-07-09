# Scripts Utils

This directory contains TypeScript utility scripts for managing Berachain metadata.

## Available Scripts

### `analyzeMissingVaults.ts`
Analyzes CSV data to find missing vaults and protocols in the mainnet.json file.
- **Usage**: `pnpm run analyze:vaults [csv-path] [--non-interactive]`
- **Features**:
  - Parses CSV with proper column mapping
  - Detects missing vaults and protocols
  - Auto-fixes invalid URLs and logoURIs
  - Handles duplicate detection
  - Interactive and non-interactive modes

### `downloadVaultLogos.ts`
Downloads vault logo images from URLs in the CSV file.
- **Usage**: `pnpm run download:logos`
- **Features**:
  - Downloads images to `src/assets/vaults/`
  - Validates direct image URLs
  - Handles timeouts and errors gracefully
  - Skips existing files

### `fixValidationErrors.ts`
Fixes validation errors in mainnet.json by updating URLs and removing duplicates.
- **Usage**: `pnpm run fix:validation`
- **Features**:
  - Updates placeholder URLs from CSV data
  - Sets staking token addresses from CSV
  - Ensures unique protocol URLs
  - Removes duplicate protocols
  - Validates all URLs are https://

## CSV Structure

The scripts expect a CSV file with the following column structure:
1. ID/Hash (index 0)
2. Proposer's Email (index 1)
3. Proposer's project name (index 2)
4. Proposer's X account (index 3)
5. Best Telegram Handle (index 4)
6. **Protocol Name** (index 5)
7. Protocol Description (index 6)
8. **Protocol URL** (index 7)
9. **Protocol Logo URL** (index 8)
10. **Vault Name** (index 9)
11. **Vault Address** (index 10)
12. **Vault Logo URL** (index 11)
13. **Staking Token Address** (index 12)
14. Description/how to acquire (index 13)

## Usage Examples

```bash
# Analyze missing vaults interactively
pnpm run analyze:vaults all_vaults.csv

# Analyze missing vaults non-interactively
pnpm run analyze:vaults all_vaults.csv --non-interactive

# Download vault logos
pnpm run download:logos

# Fix validation errors
pnpm run fix:validation
```

## Dependencies

All scripts use Node.js built-in modules and TypeScript. No additional dependencies required beyond the project's existing setup. 