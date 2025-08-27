import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getSupportedFormats,
  getSupportedResolutions,
  checkFFmpegAvailability,
} from '../services/video.service';

const router = express.Router();

// Get supported video formats
router.get(
  '/supported-formats',
  asyncHandler(async (req: any, res: any) => {
    try {
      const formats = getSupportedFormats();
      res.json({
        success: true,
        data: formats,
        message: 'Supported video formats retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get supported formats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// Get supported video resolutions
router.get(
  '/supported-resolutions',
  asyncHandler(async (req: any, res: any) => {
    try {
      const resolutions = getSupportedResolutions();
      res.json({
        success: true,
        data: resolutions,
        message: 'Supported video resolutions retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get supported resolutions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

// Health check endpoint
router.get(
  '/health',
  asyncHandler(async (req: any, res: any) => {
    try {
      const isFFmpegAvailable = await checkFFmpegAvailability();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          ffmpeg: isFFmpegAvailable ? 'available' : 'unavailable',
          timestamp: new Date().toISOString(),
        },
        message: 'Video service health check completed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
