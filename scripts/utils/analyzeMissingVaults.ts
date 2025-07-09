#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CSVRow {
  protocolName: string;
  vaultName: string;
  vaultAddress: string;
  stakingTokenAddress: string;
  protocolUrl: string;
  protocolLogoUrl: string;
  vaultLogoUrl: string;
  description: string;
}

interface Protocol {
  name: string;
  logoURI: string;
  url: string;
  description: string;
}

interface Vault {
  stakingTokenAddress: string;
  vaultAddress: string;
  name: string;
  protocol: string;
  categories: string[];
  logoURI: string;
  url: string;
  description: string;
  owner: string;
}

interface VaultsData {
  $schema: string;
  name: string;
  categories: Array<{ slug: string; description?: string }>;
  protocols: Protocol[];
  vaults: Vault[];
}

class MissingVaultAnalyzer {
  private csvPath: string;
  private jsonPath: string;
  private csvData: CSVRow[] = [];
  private jsonData: VaultsData;
  private rl: readline.Interface;

  constructor(csvPath?: string) {
    this.csvPath = csvPath || path.join(__dirname, "../../all_vaults.csv");
    this.jsonPath = path.join(__dirname, "../../src/vaults/mainnet.json");
    this.jsonData = {
      $schema: "",
      name: "",
      categories: [],
      protocols: [],
      vaults: [],
    };
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async run() {
    console.log("🔍 Starting missing vault analysis...");

    try {
      await this.loadData();
      const missingVaults = this.findMissingVaults();
      const missingProtocols = this.findMissingProtocols();

      this.generateReport(missingVaults, missingProtocols);

      if (missingVaults.length > 0 || missingProtocols.length > 0) {
        await this.promptForUpdate(missingVaults, missingProtocols);
      } else {
        console.log("\n✅ No missing vaults or protocols found!");
      }
    } catch (error) {
      console.error("❌ Error during analysis:", error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  private async loadData() {
    console.log("📂 Loading CSV data...");
    const csvContent = fs.readFileSync(this.csvPath, "utf-8");
    this.csvData = this.parseCSV(csvContent);
    console.log(`📊 Loaded ${this.csvData.length} vault entries from CSV`);

    console.log("📂 Loading JSON data...");
    const jsonContent = fs.readFileSync(this.jsonPath, "utf-8");
    this.jsonData = JSON.parse(jsonContent);
    console.log(
      `📊 Loaded ${this.jsonData.vaults.length} vaults and ${this.jsonData.protocols.length} protocols from JSON`,
    );
  }

  private parseCSV(content: string): CSVRow[] {
    const lines = content.split("\n");
    const rows: CSVRow[] = [];

    // Find the actual data rows (skip headers and metadata)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      // Look for lines that contain vault addresses (0x...)
      if (line.includes("0x") && line.length > 100) {
        const fields = this.parseCSVLine(line);

        // Use specific column indices based on CSV structure
        if (fields.length >= 14) {
          const protocolName = fields[5]?.trim() || "";
          const _protocolDescription = fields[6]?.trim() || "";
          const protocolUrl = this.fixURL(fields[7]?.trim() || "");
          const protocolLogoUrl = this.fixLogoURI(fields[8]?.trim() || "");
          const vaultName = fields[9]?.trim() || "";
          const vaultAddress = this.fixVaultAddress(fields[10]?.trim() || "");
          const vaultLogoUrl = this.fixLogoURI(fields[11]?.trim() || "");
          const stakingAddress = this.fixVaultAddress(fields[12]?.trim() || "");
          const description = fields[13]?.trim() || "";

          // Only include rows with valid vault addresses
          if (vaultAddress && stakingAddress && protocolName && vaultName) {
            const row: CSVRow = {
              protocolName,
              vaultName,
              vaultAddress,
              stakingTokenAddress: stakingAddress,
              protocolUrl,
              protocolLogoUrl,
              vaultLogoUrl,
              description,
            };

            rows.push(row);
          }
        }
      }
    }

    return rows;
  }

  private findVaultAddress(fields: string[]): string {
    for (const field of fields) {
      if (field.startsWith("0x") && field.length === 42) {
        return field;
      }
    }
    return "";
  }

  private findStakingAddress(fields: string[]): string {
    // Look for second 0x address after vault address
    let foundVault = false;
    for (const field of fields) {
      if (field.startsWith("0x") && field.length === 42) {
        if (foundVault) {
          return field;
        }
        foundVault = true;
      }
    }
    return "";
  }

  private findProtocolName(fields: string[]): string {
    // Look for protocol name in various positions
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i].trim();
      if (
        field &&
        !field.startsWith("0x") &&
        !field.includes("http") &&
        field.length > 2 &&
        field.length < 50
      ) {
        // Check if it looks like a protocol name
        if (/^[A-Za-z\s]+$/.test(field)) {
          return field;
        }
      }
    }
    return "";
  }

  private findVaultName(fields: string[]): string {
    // Look for vault name (usually contains | or - or specific patterns)
    for (const field of fields) {
      const trimmed = field.trim();
      if (
        trimmed &&
        (trimmed.includes("|") ||
          trimmed.includes("-") ||
          trimmed.includes("Vault") ||
          trimmed.includes("Island") ||
          trimmed.includes("Pool") ||
          trimmed.includes("LP") ||
          (trimmed.length > 5 &&
            trimmed.length < 100 &&
            !trimmed.startsWith("http") &&
            !trimmed.startsWith("0x")))
      ) {
        // Clean up the vault name
        let cleanName = trimmed;

        // Remove protocol descriptions that got mixed in
        if (cleanName.includes("(") && cleanName.includes(")")) {
          cleanName = cleanName.replace(/\([^)]+\)/g, "").trim();
        }

        // Remove URLs that got mixed in
        if (cleanName.includes("http")) {
          cleanName = cleanName.replace(/https?:\/\/[^\s]+/g, "").trim();
        }

        // Remove very long descriptions
        if (cleanName.length > 80) {
          cleanName = `${cleanName.substring(0, 80)}...`;
        }

        return cleanName;
      }
    }
    return "";
  }

  private findProtocolUrl(fields: string[]): string {
    for (const field of fields) {
      if (
        field.startsWith("http") &&
        field.includes(".") &&
        !field.includes("drive.google.com")
      ) {
        return field.trim();
      }
    }
    return "";
  }

  private fixLogoURI(logoURI: string): string {
    // Replace invalid logoURIs with default Cloudinary URL
    if (
      !logoURI ||
      logoURI.includes("drive.google.com") ||
      logoURI.includes("docs.") ||
      logoURI.includes("static.kodiak.finance") ||
      logoURI.includes("github.com") ||
      logoURI.includes("imgur.com") ||
      logoURI.includes("i.imgur.com") ||
      logoURI.includes("pbs.twimg.com") ||
      logoURI.includes("honeypotfinance.notion.site") ||
      logoURI.includes("static.frax.com") ||
      !logoURI.startsWith("https://") ||
      !logoURI.match(
        /^(https:\/\/raw\.githubusercontent\.com\/berachain\/metadata\/[^\s]+|https:\/\/(assets|coin-images)\.coingecko\.com\/[^\s]+|https:\/\/res\.cloudinary\.com\/duv0g402y\/[^\s]+)$/,
      )
    ) {
      return "https://res.cloudinary.com/duv0g402y/image/upload/v1746534876/tokens/default.png";
    }
    return logoURI;
  }

  private fixURL(url: string): string {
    // Fix malformed URLs
    if (!url) return "";

    let fixedUrl = url.trim();

    // Handle complex URLs with multiple domains
    if (fixedUrl.includes(",") || fixedUrl.includes(" and ")) {
      // Take the first URL if multiple are provided
      const firstUrl = fixedUrl
        .split(/[,\s]+and\s+/)[0]
        .split(",")[0]
        .trim();
      fixedUrl = firstUrl;
    }

    // Add https:// if missing
    if (!fixedUrl.startsWith("http")) {
      fixedUrl = `https://${fixedUrl}`;
    }

    // Remove trailing commas and extra text
    fixedUrl = fixedUrl.replace(/,\s*[^,]+$/, "");
    fixedUrl = fixedUrl.replace(/\s+and\s+[^,\s]+\.com/, "");

    // Handle special cases
    if (fixedUrl.includes("Webapp not live yet")) {
      return "https://berachain.com";
    }

    if (fixedUrl.includes("QIA itself does have a dapp")) {
      return "https://panda.kodiak.finance/trade/0x41fc191d145307667ea3e50f244b78de9cddf53f";
    }

    return fixedUrl;
  }

  private fixVaultAddress(address: string): string {
    // Ensure vault address is properly formatted
    if (!address || !address.startsWith("0x")) return "";

    // Remove any extra characters and ensure it's 42 characters (0x + 40 hex chars)
    const cleanAddress = address.replace(/[^0-9a-fA-Fx]/g, "");
    if (cleanAddress.length === 42) {
      return cleanAddress;
    }

    return "";
  }

  private findProtocolLogoUrl(fields: string[]): string {
    for (const field of fields) {
      if (
        field.startsWith("http") &&
        (field.includes(".png") ||
          field.includes(".jpg") ||
          field.includes("cloudinary"))
      ) {
        return field.trim();
      }
    }
    return "";
  }

  private findVaultLogoUrl(fields: string[]): string {
    // Look for second logo URL
    let foundFirst = false;
    for (const field of fields) {
      if (
        field.startsWith("http") &&
        (field.includes(".png") ||
          field.includes(".jpg") ||
          field.includes("cloudinary"))
      ) {
        if (foundFirst) {
          return field.trim();
        }
        foundFirst = true;
      }
    }
    return "";
  }

  private findDescription(fields: string[]): string {
    // Look for longer text fields that might be descriptions
    for (const field of fields) {
      const trimmed = field.trim();
      if (
        trimmed.length > 20 &&
        trimmed.length < 300 &&
        !trimmed.startsWith("http") &&
        !trimmed.startsWith("0x")
      ) {
        // Clean up the description
        let cleanDesc = trimmed;

        // Remove URLs
        cleanDesc = cleanDesc.replace(/https?:\/\/[^\s]+/g, "");

        // Remove very long descriptions
        if (cleanDesc.length > 200) {
          cleanDesc = `${cleanDesc.substring(0, 200)}...`;
        }

        return cleanDesc.trim();
      }
    }
    return "";
  }

  private parseCSVLine(line: string): string[] {
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

  private findMissingVaults(): CSVRow[] {
    const existingVaultAddresses = new Set(
      this.jsonData.vaults.map((vault) => vault.vaultAddress.toLowerCase()),
    );

    return this.csvData.filter(
      (row) =>
        row.vaultAddress &&
        !existingVaultAddresses.has(row.vaultAddress.toLowerCase()),
    );
  }

  private findMissingProtocols(): string[] {
    const existingProtocolNames = new Set(
      this.jsonData.protocols.map((protocol) => protocol.name.toLowerCase()),
    );

    const existingProtocolUrls = new Set(
      this.jsonData.protocols
        .map((protocol) => protocol.url.toLowerCase())
        .filter((url) => url && url !== "https://berachain.com"),
    );

    const csvProtocolNames = new Set(
      this.csvData
        .map((row) => row.protocolName)
        .filter((name) => name && name.trim() !== "")
        .map((name) => name.toLowerCase()),
    );

    return Array.from(csvProtocolNames).filter((name) => {
      // Check exact name match
      if (existingProtocolNames.has(name)) {
        return false;
      }

      // Extract individual protocol names from complex multi-protocol entries
      const individualProtocols = this.extractIndividualProtocols(name);

      // Check if any individual protocol already exists
      for (const individualProtocol of individualProtocols) {
        if (existingProtocolNames.has(individualProtocol)) {
          return false;
        }

        // Check if any existing protocol contains this individual protocol or vice versa
        for (const existingName of existingProtocolNames) {
          if (
            individualProtocol.includes(existingName) ||
            existingName.includes(individualProtocol)
          ) {
            return false;
          }
        }
      }

      // Check if protocol URL already exists
      const csvRow = this.csvData.find(
        (row) => row.protocolName.toLowerCase() === name,
      );
      if (csvRow?.protocolUrl) {
        const normalizedUrl = this.fixURL(csvRow.protocolUrl).toLowerCase();
        if (existingProtocolUrls.has(normalizedUrl)) {
          return false;
        }
      }

      return true;
    });
  }

  private extractIndividualProtocols(complexName: string): string[] {
    const protocols: string[] = [];

    // Handle common patterns in multi-protocol names
    const patterns = [
      /([a-zA-Z]+)\s*:\s*([^,]+)/g, // "Protocol: description"
      /([a-zA-Z]+)\s*\(\s*([^)]+)\s*\)/g, // "Protocol (description)"
      /([a-zA-Z]+)\s*and\s*([a-zA-Z]+)/g, // "Protocol1 and Protocol2"
      /([a-zA-Z]+)\s*,\s*([a-zA-Z]+)/g, // "Protocol1, Protocol2"
    ];

    // Extract protocol names from complex descriptions
    for (const pattern of patterns) {
      const matches = complexName.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) protocols.push(match[1].toLowerCase());
        if (match[2]) protocols.push(match[2].toLowerCase());
      }
    }

    // Also check for common protocol names that might be embedded
    const commonProtocols = [
      "goldilocks",
      "origami",
      "steer",
      "beradrome",
      "kodiak",
      "dolomite",
      "euler",
      "infrared",
      "wasabee",
      "fatbera",
      "berabtc",
    ];

    for (const protocol of commonProtocols) {
      if (complexName.includes(protocol)) {
        protocols.push(protocol);
      }
    }

    return [...new Set(protocols)]; // Remove duplicates
  }

  private generateReport(missingVaults: CSVRow[], missingProtocols: string[]) {
    console.log("\n📋 Analysis Report");
    console.log("==================");

    console.log(`\n🔍 Missing Vaults: ${missingVaults.length}`);
    if (missingVaults.length > 0) {
      missingVaults.forEach((vault, index) => {
        console.log(
          `  ${index + 1}. ${vault.vaultName} (${vault.protocolName})`,
        );
        console.log(`     Vault: ${vault.vaultAddress}`);
        console.log(`     Staking: ${vault.stakingTokenAddress}`);
      });
    }

    console.log(`\n🔍 Missing Protocols: ${missingProtocols.length}`);
    if (missingProtocols.length > 0) {
      missingProtocols.forEach((protocol, index) => {
        console.log(`  ${index + 1}. ${protocol}`);
      });
    }

    console.log("\n📊 Summary:");
    console.log(`  - Total vaults in CSV: ${this.csvData.length}`);
    console.log(`  - Total vaults in JSON: ${this.jsonData.vaults.length}`);
    console.log(`  - Missing vaults: ${missingVaults.length}`);
    console.log(`  - Missing protocols: ${missingProtocols.length}`);
  }

  private async promptForUpdate(
    missingVaults: CSVRow[],
    missingProtocols: string[],
  ) {
    return new Promise<void>((resolve) => {
      this.rl.question(
        "\n📝 Would you like to update the JSON file with missing entries? (y/n): ",
        async (answer) => {
          if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
            this.showUpdatePreview(missingVaults, missingProtocols);

            this.rl.question(
              "\n🔄 Proceed with update? (y/n): ",
              async (confirm) => {
                if (
                  confirm.toLowerCase() === "y" ||
                  confirm.toLowerCase() === "yes"
                ) {
                  await this.updateJSON(missingVaults, missingProtocols);
                } else {
                  console.log("❌ Update cancelled.");
                }
                resolve();
              },
            );
          } else {
            console.log("❌ Update cancelled.");
            resolve();
          }
        },
      );
    });
  }

  private showUpdatePreview(
    missingVaults: CSVRow[],
    missingProtocols: string[],
  ) {
    console.log("\n📝 Preview of updates that would be made:");

    if (missingProtocols.length > 0) {
      console.log("\n🆕 New protocols to add:");
      missingProtocols.forEach((protocolName) => {
        const protocolData = this.csvData.find(
          (row) =>
            row.protocolName.toLowerCase() === protocolName.toLowerCase(),
        );

        if (protocolData) {
          console.log(`  - ${protocolData.protocolName}`);
          console.log(
            `    URL: ${protocolData.protocolUrl || "https://berachain.com"}`,
          );
          console.log(
            `    Logo: ${protocolData.protocolLogoUrl || "default.png"}`,
          );
        }
      });
    }

    if (missingVaults.length > 0) {
      console.log("\n🆕 New vaults to add:");
      missingVaults.forEach((vault) => {
        console.log(`  - ${vault.vaultName} (${vault.protocolName})`);
        console.log(`    Vault: ${vault.vaultAddress}`);
        console.log(`    Staking: ${vault.stakingTokenAddress}`);
      });
    }
  }

  async updateJSON(missingVaults: CSVRow[], missingProtocols: string[]) {
    console.log("\n🔄 Updating JSON file...");

    // Add missing protocols (check for duplicates)
    missingProtocols.forEach((protocolName) => {
      const protocolData = this.csvData.find(
        (row) => row.protocolName.toLowerCase() === protocolName.toLowerCase(),
      );

      if (protocolData) {
        // Check if protocol URL already exists
        const existingProtocol = this.jsonData.protocols.find(
          (p) =>
            p.url === protocolData.protocolUrl &&
            protocolData.protocolUrl !== "",
        );

        if (!existingProtocol) {
          const newProtocol: Protocol = {
            name: protocolData.protocolName,
            logoURI: this.fixLogoURI(protocolData.protocolLogoUrl),
            url: this.fixURL(protocolData.protocolUrl),
            description: protocolData.description || "",
          };

          this.jsonData.protocols.push(newProtocol);
        }
      }
    });

    // Add missing vaults (check for duplicates)
    missingVaults.forEach((vault) => {
      const fixedVaultAddress = this.fixVaultAddress(vault.vaultAddress);

      // Check if vault address already exists
      const existingVault = this.jsonData.vaults.find(
        (v) => v.vaultAddress.toLowerCase() === fixedVaultAddress.toLowerCase(),
      );

      if (!existingVault) {
        const newVault: Vault = {
          stakingTokenAddress: this.fixVaultAddress(vault.stakingTokenAddress),
          vaultAddress: fixedVaultAddress,
          name: vault.vaultName,
          protocol: vault.protocolName,
          categories: ["defi"],
          logoURI: this.fixLogoURI(vault.vaultLogoUrl),
          url: this.fixURL(vault.protocolUrl),
          description: vault.description || "",
          owner: "Foundation",
        };

        this.jsonData.vaults.push(newVault);
      }
    });

    // Write updated JSON
    const updatedContent = JSON.stringify(this.jsonData, null, 2);
    fs.writeFileSync(this.jsonPath, updatedContent);

    console.log("✅ JSON file updated successfully!");
    console.log(`  - Added ${missingProtocols.length} protocols`);
    console.log(`  - Added ${missingVaults.length} vaults`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const csvPath = args.find((arg) => !arg.startsWith("-"));
const isNonInteractive =
  args.includes("--non-interactive") || args.includes("-n");

// Run the analyzer
const analyzer = new MissingVaultAnalyzer(csvPath);

if (isNonInteractive) {
  // Run analysis without prompts
  analyzer
    .run()
    .then(() => {
      console.log("\n✅ Analysis completed in non-interactive mode");
    })
    .catch(console.error);
} else {
  // Run with interactive prompts
  analyzer.run().catch(console.error);
}
