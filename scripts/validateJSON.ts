// Imports
// ================================================================
import fs from 'fs';
import path from 'path';

// Config
// ================================================================
const METADATA_FOLDER = 'src';
const FOLDER_PATH = path.join(__dirname, `../${METADATA_FOLDER}`);
const METADATA_FOLDER_EXCLUDED = ['assets'];

// Functions
// ================================================================
/**
 * Checks if a string is a valid JSON
 * @param jsonString - The string to check
 * @returns True if the string is a valid JSON, false otherwise
 */
const isValidJSON = (jsonString: string) => {
  try {
      JSON.parse(jsonString);
      return true;
  } catch (e) {
      return false;
  }
};

/**
 * Checks all images in the metadata folder for valid dimensions
 */
const validateJSONFiles = () => {
  let errors: string[] = [];

  // Get all the folder in the src folder excludingt the 'METADATA_FOLDER_EXCLUDES' folder
  const folders = fs.readdirSync(path.join(__dirname, `../${METADATA_FOLDER}`), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !METADATA_FOLDER_EXCLUDED.includes(entry.name))
    .map(entry => entry.name);

  // Get all json file in all folders
  let jsonMetadata: {
    [key: string]: {
      [key: string]: any
    }
  } = {};
  for (const folder of folders) { 
    const files = fs.readdirSync(path.join(__dirname, `../${METADATA_FOLDER}/${folder}`), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => {
        const file = `${folder}/${entry.name}`;

        // Validate JSON file
        const jsonString = fs.readFileSync(path.join(__dirname, `../${METADATA_FOLDER}/${file}`), 'utf8');
        if (!isValidJSON(jsonString)) {
          errors.push(`Invalid JSON file: ${file}`);
        }

        return {
          folder,
          file,
        };
      });
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} Errors found in metadata:`);
    errors.forEach(error => console.warn('\x1b[33m%s\x1b[0m', error));
    process.exit(1);
  }
};

// Initialize
// ================================================================
validateJSONFiles();