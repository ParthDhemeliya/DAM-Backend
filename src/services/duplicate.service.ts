import { Pool } from 'pg';
import { getPool } from '../config/database.config';
import { Asset, CreateAssetRequest } from '../interfaces/asset.interface';
import crypto from 'crypto';

// Shared database pool instance
const pool: Pool = getPool();

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'filename' | 'content' | 'both' | 'none';
  existingAssets: Asset[];
  contentHash: string;
  suggestedFilename?: string;
}

export interface DuplicateHandlingOptions {
  action: 'skip' | 'replace' | 'error';
  replaceAssetId?: number; // ID of asset to replace if action is 'replace'
}

export interface DuplicateHandlingResult {
  action: 'skipped' | 'replaced' | 'error';
  asset?: Asset;
  message: string;
  duplicateInfo?: DuplicateCheckResult;
}

// Generate content hash for a file buffer
export const generateContentHash = (fileBuffer: Buffer): string => {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Check if a file is a duplicate based on filename and content
export const checkForDuplicates = async (
  filename: string,
  fileBuffer: Buffer,
  originalName?: string
): Promise<DuplicateCheckResult> => {
  try {
    const contentHash = generateContentHash(fileBuffer);

    // Check for duplicates by content hash first (most reliable)
    const contentQuery = `
      SELECT * FROM assets 
      WHERE metadata->>'contentHash' = $1 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const contentResult = await pool.query(contentQuery, [contentHash]);

    // Check for duplicates by filename (even if content is different)
    const filenameQuery = `
      SELECT * FROM assets 
      WHERE filename = $1 
      AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const filenameResult = await pool.query(filenameQuery, [filename]);

    // Check for duplicates by original name
    let originalNameResult = { rows: [] };
    if (originalName) {
      const originalNameQuery = `
        SELECT * FROM assets 
        WHERE original_name = $1 
        AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;
      originalNameResult = await pool.query(originalNameQuery, [originalName]);
    }

    const existingAssets = [
      ...contentResult.rows,
      ...filenameResult.rows,
      ...originalNameResult.rows,
    ];

    // Remove duplicates based on ID
    const uniqueAssets = existingAssets.filter(
      (asset, index, self) => index === self.findIndex(a => a.id === asset.id)
    );

    if (uniqueAssets.length === 0) {
      return {
        isDuplicate: false,
        duplicateType: 'none',
        existingAssets: [],
        contentHash,
      };
    }

    // Determine duplicate type - check both content and filename
    let duplicateType: 'filename' | 'content' | 'both' | 'none' = 'none';
    const hasContentDuplicate = contentResult.rows.length > 0;
    const hasFilenameDuplicate = filenameResult.rows.length > 0;
    const hasOriginalNameDuplicate = originalNameResult.rows.length > 0;

    if (hasContentDuplicate && hasFilenameDuplicate) {
      duplicateType = 'both';
    } else if (hasContentDuplicate) {
      duplicateType = 'content';
    } else if (hasFilenameDuplicate || hasOriginalNameDuplicate) {
      duplicateType = 'filename';
    }

    // Generate suggested filename if there's a filename conflict
    let suggestedFilename: string | undefined;
    if (hasFilenameDuplicate || hasOriginalNameDuplicate) {
      const timestamp = Date.now();
      const extension = filename.split('.').pop() || '';
      const nameWithoutExt = filename.replace(`.${extension}`, '');
      suggestedFilename = `${nameWithoutExt}_${timestamp}.${extension}`;
    }

    return {
      isDuplicate: true,
      duplicateType,
      existingAssets: uniqueAssets,
      contentHash,
      suggestedFilename,
    };
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    throw new Error('Failed to check for duplicates');
  }
};

// Handle duplicate file based on user preferences
export const handleDuplicateFile = async (
  duplicateInfo: DuplicateCheckResult,
  options: DuplicateHandlingOptions,
  assetData: CreateAssetRequest,
  fileBuffer: Buffer
): Promise<DuplicateHandlingResult> => {
  try {
    switch (options.action) {
      case 'skip':
        return {
          action: 'skipped',
          message: `File skipped - duplicate detected: ${duplicateInfo.duplicateType}`,
          duplicateInfo,
        };

      case 'replace': {
        if (!options.replaceAssetId) {
          throw new Error(
            'replaceAssetId is required when action is "replace"'
          );
        }

        // Find the asset to replace
        const assetToReplace = duplicateInfo.existingAssets.find(
          asset => asset.id === options.replaceAssetId
        );

        if (!assetToReplace) {
          throw new Error('Asset to replace not found');
        }

        // Update the existing asset with new data
        const updateQuery = `
          UPDATE assets 
          SET 
            filename = $1,
            original_name = $2,
            file_type = $3,
            mime_type = $4,
            file_size = $5,
            storage_path = $6,
            metadata = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8 AND deleted_at IS NULL
          RETURNING *
        `;

        const updateValues = [
          assetData.filename,
          assetData.original_name,
          assetData.file_type,
          assetData.mime_type,
          assetData.file_size,
          assetData.storage_path,
          JSON.stringify({
            ...assetData.metadata,
            contentHash: duplicateInfo.contentHash,
            replacedAt: new Date().toISOString(),
            replacedFrom: assetToReplace.filename,
          }),
          options.replaceAssetId,
        ];

        const updateResult = await pool.query(updateQuery, updateValues);

        if (!updateResult.rows[0]) {
          throw new Error('Failed to replace asset');
        }

        return {
          action: 'replaced',
          asset: updateResult.rows[0],
          message: `Asset replaced successfully`,
          duplicateInfo,
        };
      }

      // Rename functionality removed - only skip and replace are supported

      case 'error':
        throw new Error(
          `Duplicate file detected: ${duplicateInfo.duplicateType}. Existing assets: ${duplicateInfo.existingAssets.map(a => a.filename).join(', ')}`
        );

      default:
        throw new Error(`Invalid duplicate handling action: ${options.action}`);
    }
  } catch (error) {
    console.error('Error handling duplicate file:', error);
    throw error;
  }
};

// Get duplicate handling options from request
export const parseDuplicateHandlingOptions = (
  req: any
): DuplicateHandlingOptions => {
  const { duplicateAction, replaceAssetId } = req.body;

  // Default to 'error' if no action specified
  const action = duplicateAction || 'error';

  if (action === 'replace' && !replaceAssetId) {
    throw new Error(
      'replaceAssetId is required when duplicateAction is "replace"'
    );
  }

  return {
    action,
    replaceAssetId: replaceAssetId ? parseInt(replaceAssetId) : undefined,
  };
};
