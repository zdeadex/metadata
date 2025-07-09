#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CSVRow {
  vaultAddress: string;
  logoUrl: string;
}

const CSV_PATH = path.join(process.cwd(), 'all_vaults.csv');
const ASSETS_DIR = path.join(process.cwd(), 'src/assets/vaults');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function isDirectImageUrl(url: string): boolean {
  return /^https:\/\/.*\.(png|jpg|jpeg|gif|webp)$/i.test(url);
}

async function downloadImage(url: string, outPath: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(outPath, Buffer.from(buffer));
      console.log(`Downloaded: ${outPath}`);
      return true;
    } else {
      console.log(`Failed to download ${url}: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`Error downloading ${url}: ${error}`);
  }
  return false;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

async function main() {
  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const fields = parseCSVLine(line);
      if (fields.length < 13) continue;
      
      const vaultAddress = fields[10]?.trim().replace(/"/g, '') || '';
      const logoUrl = fields[8]?.trim().replace(/"/g, '') || '';
      
      if (/^0x[a-fA-F0-9]{40}$/.test(vaultAddress) && isDirectImageUrl(logoUrl)) {
        const ext = path.extname(logoUrl).split('?')[0];
        const outPath = path.join(ASSETS_DIR, `${vaultAddress}${ext}`);
        
        if (!fs.existsSync(outPath)) {
          await downloadImage(logoUrl, outPath);
        }
      }
    }
  } catch (error) {
    console.error('Error processing CSV:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 