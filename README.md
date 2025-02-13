# 🐻 Berachain Metadata

This repository contains the default lists for Berachain's interfaces, including:

- [tokens](#adding-a-token)
- [vaults](#adding-a-vault)
- [validators](#adding-a-validator)

## Overview

- `src/tokens/`: Token lists for different networks
- `src/vaults/`: Vault lists for different networks
- `src/validators/`: Validator lists for different networks
- `src/assets/`: Image assets for tokens, vaults, and validators

## Contributing

Please make additions to this repo by 1) forking the repo and 2) submitting a Pull Request. Please note that:

- Submitting a PR _DOES NOT_ guarantee addition to the lists
- All PRs should include relevant assets in the `assets/` directory

### Adding a Token

```json
{
  "chainId": 80094,
  "address": "0x688e72142674041f8f6Af4c808a4045cA1D6aC82",
  "symbol": "BYUSD",
  "name": "BYUSD",
  "logoURI": "https://res.cloudinary.com/duv0g402y/image/upload/v1738732576/tokens/y6wa21vehnappbe2cruf.png",
  "decimals": 6,
  "tags": ["stablecoin", "featured"]
}
```

#### Required Fields:

- `chainId`: Chain ID of the network (`80094` for mainnet)
- `address`: Token contract address
- `symbol`: Token symbol
- `name`: Token name
- `logoURI`: Path to token icon
- `decimals`: Token decimal places
- `tags`: Array of tags (can leave empty)

### Adding a Vault

```json
{
  "stakingTokenAddress": "0x2c4a603a2aa5596287a06886862dc29d56dbc354",
  "vaultAddress": "0xc2baa8443cda8ebe51a640905a8e6bc4e1f9872c",
  "name": "WBERA | HONEY",
  "logoURI": "https://res.cloudinary.com/duv0g402y/image/upload/v1738378469/reward-vaults/icons/soy9mfpovb1odtby9p02.png",
  "protocol": "HUB",
  "url": "https://hub.berachain.com/pools/0x2c4a603a2aa5596287a06886862dc29d56dbc354000200000000000000000002/details/"
}
```

#### Required Fields:

- `stakingTokenAddress`: Address of the token being staked
- `vaultAddress`: Vault contract address
- `name`: Vault name
- `logoURI`: Path to vault icon
- `protocol`: Protocol name
- `url`: Hub URL for the vault

### Adding a Validator

```json
{
  "id": "0x960052c5509caa280218f3ecf3da7ba5bf4ec20b97e6c52700dd93515ef4e963813aa92a8731c9e137b1027dbc77102f",
  "logoURI": "https://res.cloudinary.com/duv0g402y/raw/upload/src/assets/Lugahill_square.png",
  "name": "Luganodes",
  "description": "Swiss-Operated Institutional Grade Staking Provider",
  "website": "https://luganodes.com",
  "twitter": "https://x.com/luganodes"
}
```

#### Required Fields:

- `id`: Validator public key
- `logoURI`: Path to validator icon
- `name`: Validator name
- `description`: A short description for the validator (optional)
- `website`: Validator's website (optional)
- `twitter`: Validator's twitter account URL (optional)

### Asset Guidelines

- Upload assets to the `assets/` directory
- Use PNG format with transparent background
- Recommended size: 256x256 pixels

### Validating Lists

```bash
pnpm run validate
```
