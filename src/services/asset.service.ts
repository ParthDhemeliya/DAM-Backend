import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface';
import { AssetRepository } from '../repositories/asset.repository';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../clients/s3';

// Extended Asset interface for signed URLs
interface AssetWithSignedUrl extends Asset {
  signedUrl?: string;
  expiresAt?: string;
}

const assetRepository = new AssetRepository();

export const getAssetById = async (id: number): Promise<Asset | null> => {
  return await assetRepository.findById(id);
};

export const getAllAssets = async (): Promise<Asset[]> => {
  return await assetRepository.findAll();
};

export const createAsset = async (
  assetData: CreateAssetRequest
): Promise<Asset> => {
  return await assetRepository.create(assetData);
};

export const updateAsset = async (
  id: number,
  assetData: UpdateAssetRequest
): Promise<Asset | null> => {
  return await assetRepository.update(id, assetData);
};

export const deleteAsset = async (id: number): Promise<boolean> => {
  return await assetRepository.delete(id);
};

export const getAssetsWithFilters = async (filters: {
  page: number;
  limit: number;
  fileType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  category?: string;
  author?: string;
  department?: string;
  project?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ assets: Asset[]; pagination: any }> => {
  return await assetRepository.findWithFilters(filters);
};

export const searchAssets = async (filters: {
  query: string;
  page: number;
  limit: number;
  fileType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ assets: Asset[]; pagination: any }> => {
  return await assetRepository.search(filters.query, filters);
};

export const getAssetsWithSignedUrls = async (
  assetIds: number[],
  expiresIn: number = 3600
): Promise<AssetWithSignedUrl[]> => {
  const assets = await assetRepository.findByIds(assetIds);

  const assetsWithUrls = await Promise.all(
    assets.map(async asset => {
      try {
        const signedUrl = await generateSignedUrl(
          asset.storage_path,
          expiresIn
        );
        return {
          ...asset,
          signedUrl,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        };
      } catch (error) {
        console.error(
          `Failed to generate signed URL for asset ${asset.id}:`,
          error
        );
        return asset;
      }
    })
  );

  return assetsWithUrls;
};

export const getAssetWithSignedUrl = async (
  assetId: number,
  expiresIn: number = 3600
): Promise<AssetWithSignedUrl | null> => {
  const asset = await assetRepository.findById(assetId);
  if (!asset) return null;

  try {
    const signedUrl = await generateSignedUrl(asset.storage_path, expiresIn);
    return {
      ...asset,
      signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  } catch (error) {
    console.error(
      `Failed to generate signed URL for asset ${asset.id}:`,
      error
    );
    return asset;
  }
};

export const checkDuplicates = async (
  assetId: number,
  options: {
    checkContentHash?: boolean;
    checkFilename?: boolean;
    checkFileSize?: boolean;
    threshold?: number;
  } = {}
): Promise<any> => {
  const asset = await assetRepository.findById(assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found`);
  }

  const duplicates = await assetRepository.checkDuplicates(
    asset.filename,
    asset.file_size,
    asset.metadata?.contentHash
  );
  return duplicates;
};

// Private helper function
const generateSignedUrl = async (
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.MINIO_BUCKET || 'dam-media',
    Key: storagePath,
  });

  return await getSignedUrl(s3, command, { expiresIn });
};

export const validateAssetMetadata = async (asset: Asset): Promise<Asset> => {
  // Validate and clean metadata
  if (asset.metadata) {
    // Ensure metadata.custom exists
    if (!asset.metadata.custom) {
      asset.metadata.custom = {};
    }

    // Validate file type
    if (
      asset.file_type &&
      !['image', 'video', 'audio', 'document', 'archive'].includes(
        asset.file_type
      )
    ) {
      asset.file_type = 'other';
    }

    // Validate status
    if (
      asset.status &&
      !['active', 'archived', 'deleted', 'processing'].includes(asset.status)
    ) {
      asset.status = 'processed';
    }
  }

  return asset;
};

export const processAssetMetadata = async (asset: Asset): Promise<Asset> => {
  // Process and enhance metadata
  if (asset.metadata) {
    // Add processing timestamp
    if (!asset.metadata.custom) {
      asset.metadata.custom = {};
    }

    asset.metadata.custom.last_processed = new Date().toISOString();

    // Add file size in human readable format
    if (asset.file_size) {
      asset.metadata.custom.size_formatted = formatFileSize(asset.file_size);
    }
  }

  return asset;
};

export const getAssetAnalytics = async (id: number): Promise<any> => {
  const asset = await assetRepository.findById(id);
  if (!asset) return null;

  // Get analytics data for the asset
  const analytics = {
    assetId: id,
    views: 0, // This would come from analytics service
    downloads: 0, // This would come from analytics service
    processingTime: 0, // This would come from job history
    lastAccessed: asset.updated_at,
    fileType: asset.file_type,
    size: asset.file_size,
  };

  return analytics;
};

export const bulkUpdateAssets = async (
  assetIds: number[],
  updates: Partial<UpdateAssetRequest>
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const id of assetIds) {
    try {
      await assetRepository.update(id, updates);
      success++;
    } catch (error) {
      console.error(`Failed to update asset ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

export const getAssetStatistics = async (): Promise<any> => {
  // Get overall asset statistics
  const stats = {
    totalAssets: 0,
    totalSize: 0,
    byType: {},
    byStatus: {},
    byCategory: {},
    recentUploads: [],
  };

  return stats;
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
