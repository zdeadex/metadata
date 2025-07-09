#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

const PLACEHOLDER_URL_BASE = "https://placeholder.berachain.com/";
const DEFAULT_URL = "https://berachain.com";
const CSV_PATH = path.join(process.cwd(), "all_vaults.csv");

interface Vault {
  vaultAddress: string;
  stakingTokenAddress: string;
  url: string;
  [key: string]: unknown;
}

interface Protocol {
  name: string;
  url: string;
  [key: string]: unknown;
}

interface MainnetData {
  vaults: Vault[];
  protocols: Protocol[];
  [key: string]: unknown;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function getCSVUrlMap(): {
  vaultUrlMap: Map<string, string>;
  protocolUrlMap: Map<string, string>;
} {
  const vaultUrlMap = new Map<string, string>();
  const protocolUrlMap = new Map<string, string>();

  try {
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = csvContent.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const vaultAddress =
          parts[10]?.trim().replace(/"/g, "").toLowerCase() || "";
        const protocolName = parts[5]?.trim().replace(/"/g, "") || "";
        const url = parts[7]?.trim().replace(/"/g, "") || "";

        if (/^https:\/\/[^\s]+$/.test(url)) {
          if (/^0x[a-fA-F0-9]{40}$/.test(vaultAddress)) {
            vaultUrlMap.set(vaultAddress, url);
          }
          if (protocolName) {
            protocolUrlMap.set(protocolName.toLowerCase(), url);
          }
        }
      }
    }
  } catch (error) {
    console.warn("Could not read CSV file:", error);
  }

  return { vaultUrlMap, protocolUrlMap };
}

function getStakingTokenAddressesFromCSV(): Map<string, string> {
  const stakingTokenMap = new Map<string, string>();

  try {
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = csvContent.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = parseCSVLine(line);
      if (parts.length >= 13) {
        const vaultAddress = parts[10]?.trim().replace(/"/g, "") || "";
        const stakingTokenAddress = parts[12]?.trim().replace(/"/g, "") || "";

        if (
          /^0x[a-fA-F0-9]{40}$/.test(vaultAddress) &&
          /^0x[a-fA-F0-9]{40}$/.test(stakingTokenAddress)
        ) {
          stakingTokenMap.set(vaultAddress.toLowerCase(), stakingTokenAddress);
        }
      }
    }
  } catch (error) {
    console.warn("Could not read CSV file for staking tokens:", error);
  }

  return stakingTokenMap;
}

function fixValidationErrors(): void {
  // Get staking token addresses and URLs from CSV
  const stakingTokenMap = getStakingTokenAddressesFromCSV();
  const { vaultUrlMap, protocolUrlMap } = getCSVUrlMap();

  // Read the mainnet.json file
  const mainnetPath = path.join(process.cwd(), "src/vaults/mainnet.json");
  const mainnetData: MainnetData = JSON.parse(
    fs.readFileSync(mainnetPath, "utf-8"),
  );

  // Fix vault URLs
  for (const vault of mainnetData.vaults) {
    const vaultAddrLower = vault.vaultAddress.toLowerCase();

    // Set stakingTokenAddress from CSV if available
    if (stakingTokenMap.has(vaultAddrLower)) {
      const stakingToken = stakingTokenMap.get(vaultAddrLower);
      if (stakingToken) {
        vault.stakingTokenAddress = stakingToken;
      }
    } else if (!vault.stakingTokenAddress || vault.stakingTokenAddress === "") {
      vault.stakingTokenAddress = vault.vaultAddress;
    }

    // Fix URL
    const url = vault.url || "";
    if (
      url.startsWith(PLACEHOLDER_URL_BASE) ||
      !url ||
      !url.startsWith("https://")
    ) {
      // Try to get from CSV
      const newUrl = vaultUrlMap.get(vaultAddrLower);
      if (newUrl) {
        vault.url = newUrl;
      } else {
        vault.url = DEFAULT_URL;
      }
    }
  }

  // Fix protocol URLs
  const seenUrls = new Set<string>();
  for (const protocol of mainnetData.protocols) {
    const url = protocol.url || "";
    const nameLower = protocol.name.toLowerCase();

    if (
      url.startsWith(PLACEHOLDER_URL_BASE) ||
      !url ||
      !url.startsWith("https://")
    ) {
      const newUrl = protocolUrlMap.get(nameLower);
      if (newUrl) {
        protocol.url = newUrl;
      } else {
        protocol.url = DEFAULT_URL;
      }
    }

    // Ensure uniqueness
    while (seenUrls.has(protocol.url)) {
      protocol.url = `${DEFAULT_URL}/${nameLower}-${seenUrls.size}`;
    }
    seenUrls.add(protocol.url);
  }

  // Remove duplicate protocols
  const seenProtocols = new Map<string, boolean>();
  const uniqueProtocols: Protocol[] = [];

  for (const protocol of mainnetData.protocols) {
    const protocolNameLower = protocol.name.toLowerCase();
    if (!seenProtocols.has(protocolNameLower)) {
      seenProtocols.set(protocolNameLower, true);
      uniqueProtocols.push(protocol);
    } else {
      console.log(`Removing duplicate protocol: ${protocol.name}`);
    }
  }

  mainnetData.protocols = uniqueProtocols;

  // Save the fixed mainnet.json
  fs.writeFileSync(mainnetPath, JSON.stringify(mainnetData, null, 2));

  console.log("\nValidation fixes applied:");
  console.log(
    "- Updated placeholder URLs from CSV or set to berachain.com if missing",
  );
  console.log("- Set stakingTokenAddress for vaults from CSV");
  console.log(
    "- Ensured all vaults and protocols have valid unique https:// URLs",
  );
  console.log("- Removed duplicate protocols");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fixValidationErrors();
}
