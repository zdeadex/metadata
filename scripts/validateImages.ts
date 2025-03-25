// Imports
// ================================================================
import fs from 'fs';
import path from 'path';

// Config
// ================================================================
const METADATA_FOLDER = 'src';
const FOLDER_PATH = path.join(__dirname, `../${METADATA_FOLDER}/assets`);
const METADATA_FOLDER_EXCLUDED = ['assets'];

// Functions
// ================================================================
/**
 * Reads the dimensions of an image file for PNG and JPG files
 * @param imagePath - The path to the image file
 * @returns The width and height of the image, or null if the file is not a valid image
 */
const getImageDimensions = (imagePath: string): { width: number, height: number } | null => {
  const buffer = fs.readFileSync(imagePath);
  
  // Check PNG header
  if (buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    // PNG files start with 8 bytes: 89 50 4e 47 0d 0a 1a 0a
    // The width and height are located at bytes 16-19 (width) and 20-23 (height)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // Check JPG header
  if (buffer.slice(0, 2).toString('hex') === 'ff d8') {
    // JPG files start with ff d8
    let i = 2;
    while (i < buffer.length) {
      // Get segment length (2 bytes)
      const segmentLength = buffer.readUInt16BE(i + 2);
      if (buffer[i] === 0xFF && buffer[i + 1] >= 0xC0 && buffer[i + 1] <= 0xC3) {
        // Start of frame (SOF) marker, contains width and height in the segment
        const height = buffer.readUInt16BE(i + 5);
        const width = buffer.readUInt16BE(i + 7);
        return { width, height };
      }
      i += segmentLength + 2;
    }
  }

  // Unsupported file format
  return null;
};

/**
 * Checks all images in the assets folder for valid dimensions
 */
const validateAssetsImages = () => {
    // Recursive function to process files in a directory
    const processDirectory = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively process subdirectories
          processDirectory(fullPath);
        } else {
          // Check if file is an image
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            const dimensions = getImageDimensions(fullPath);
            const relativePath = path.relative(FOLDER_PATH, fullPath);

            // Validate file names
            if (relativePath.includes('tokens')) {
              const tokenRegex = /^0x[0-9a-f]{40}$/i;
              if (!tokenRegex.test(relativePath.replace(ext, '').replace('tokens/', ''))) {
                console.error(`${relativePath}: Invalid file name! Must be a valid token address.`);
                process.exit(1); // Force exit with error code 1 to fail CI
              }
            } else if (relativePath.includes('validators')) {
              const validatorRegex = /^0x[0-9a-f]{96}$/i;
              if (!validatorRegex.test(relativePath.replace(ext, '').replace('validators/', ''))) {
                console.error(`${relativePath}: Invalid file name! Must be a valid validator pubkye address.`);
                process.exit(1); // Force exit with error code 1 to fail CI
              }
            }

            if (!dimensions || dimensions.width < 1024 || dimensions.height < 1024 || dimensions?.width !== dimensions?.height) {
              console.error(`${relativePath}: Invalid (Dimensions: ${dimensions?.width}x${dimensions?.height})!`);
              process.exit(1); // Force exit with error code 1 to fail CI
            }
          } else if (['.DS_Store'].includes(ext)) {
            // Do nothing
          } else {
            console.error(`${fullPath}: Unsupported file type!`);
            process.exit(1); // Force exit with error code 1 to fail CI
          }
        }
      }
    };

    // Start processing from root folder
    processDirectory(FOLDER_PATH);
};

/**
 * Checks all images in the metadata folder for valid dimensions
 */
const validateMetadataImages = () => {
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
    const jsonFiles = fs.readdirSync(path.join(__dirname, `../${METADATA_FOLDER}/${folder}`), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => {
        const file = `${folder}/${entry.name}`;
        const content = JSON.parse(fs.readFileSync(path.join(__dirname, `../${METADATA_FOLDER}/${file}`), 'utf8'))?.[folder];

        if (!jsonMetadata[folder]) {
          jsonMetadata[folder] = {};
        }
        jsonMetadata[folder][`${entry.name}`] = content;

        return {
          folder,
          file,
          content
        };
      });
  }

  // Validate all images in the assets folder from metadata
  Object.keys(jsonMetadata).forEach(key => {
    if (key === 'tokens') {
      Object.keys(jsonMetadata[key]).forEach(file => {
        jsonMetadata[key][file].forEach(token => {
          const tokenFilePath = path.join(__dirname, `../${METADATA_FOLDER}/assets/tokens/${token.address}`);
          if (!fs.existsSync(`${tokenFilePath}.png`) && !fs.existsSync(`${tokenFilePath}.jpg`) && !fs.existsSync(`${tokenFilePath}.jpeg`)) {
            console.error(`${token.address}:\nToken file not found in assets folder!`);
            process.exit(1); // Force exit with error code 1 to fail CI
          }
        });
      });
    } else if (key === 'validators') {
      Object.keys(jsonMetadata[key]).forEach(file => {
        jsonMetadata[key][file].forEach(validator => {
          const validatorFilePath = path.join(__dirname, `../${METADATA_FOLDER}/assets/validators/${validator.id}`);
          if (!fs.existsSync(`${validatorFilePath}.png`) && !fs.existsSync(`${validatorFilePath}.jpg`) && !fs.existsSync(`${validatorFilePath}.jpeg`)) {
            console.error(`${validator.id}:\nValidator file not found in assets folder!`);
            process.exit(1); // Force exit with error code 1 to fail CI
          }
        });
      });
    } else if (key === 'vaults') {
      Object.keys(jsonMetadata[key]).forEach(file => {
        jsonMetadata[key][file].forEach(vault => {
          const vaultFilePath = path.join(__dirname, `../${METADATA_FOLDER}/assets/tokens/${vault.stakingTokenAddress}`);
          if (!fs.existsSync(`${vaultFilePath}.png`) && !fs.existsSync(`${vaultFilePath}.jpg`) && !fs.existsSync(`${vaultFilePath}.jpeg`)) {
            console.error(`${vault.stakingTokenAddress}:\nVault file not found in assets folder!`);
            process.exit(1); // Force exit with error code 1 to fail CI
          }
        });
      });
    }
  });
};

// Initialize
// ================================================================
validateAssetsImages();
validateMetadataImages();
