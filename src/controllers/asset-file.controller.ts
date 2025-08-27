import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getAssetById } from '../services/asset.service';
import { getSignedReadUrl, downloadFile } from '../services/storage';
import { Asset } from '../interfaces/asset.interface';

export class AssetFileController {
  // Download asset file
  downloadAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await getAssetById(id);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      // Check if asset is processed
      if (asset.status !== 'processed') {
        return res.status(403).json({
          success: false,
          error: 'Asset not accessible',
          message: `Asset with ID ${id} is not accessible (status: ${asset.status})`,
        });
      }

      // Get signed URL for download
      const signedUrl = await getSignedReadUrl(asset.storage_path, 3600); // 1 hour expiry

      res.json({
        success: true,
        data: {
          asset,
          downloadUrl: signedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
        message: 'Download URL generated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate download URL',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Stream asset file
  streamAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await getAssetById(id);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      // Check if asset is processed
      if (asset.status !== 'processed') {
        return res.status(403).json({
          success: false,
          error: 'Asset not accessible',
          message: `Asset with ID ${id} is not accessible (status: ${asset.status})`,
        });
      }

      // Get file stream from storage
      const fileStream = await downloadFile(asset.storage_path);

      // Set appropriate headers
      res.setHeader(
        'Content-Type',
        asset.mime_type || 'application/octet-stream'
      );
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${asset.filename}"`
      );
      res.setHeader('Content-Length', asset.file_size?.toString() || '0');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Pipe the file stream to response
      fileStream.pipe(res);

      // Handle stream errors
      fileStream.on('error', error => {
        console.error(`Stream error for asset ${id}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Stream error',
            message: 'Failed to stream asset file',
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to stream asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
