import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { FileType } from '../interfaces/asset.interface';

const execAsync = promisify(exec);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  format: string;
  fps: number;
  size: number;
}

export interface VideoProcessingOptions {
  inputPath: string;
  outputPath: string;
  resolution?: '1080p' | '720p' | '480p';
  format?: 'mp4' | 'webm' | 'mov';
  quality?: 'high' | 'medium' | 'low';
}

export interface VideoProcessingResult {
  success: boolean;
  outputPath?: string;
  metadata?: VideoMetadata;
  error?: string;
  processingTime?: number;
}

// Extract metadata from video file using FFmpeg
export const extractMetadata = async (
  filePath: string
): Promise<VideoMetadata> => {
  try {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);

    // Get video stream
    const videoStream = data.streams.find(
      (stream: any) => stream.codec_type === 'video'
    );
    const format = data.format;

    if (!videoStream) {
      throw new Error('No video stream found');
    }

    return {
      duration: parseFloat(format.duration) || 0,
      width: parseInt(videoStream.width) || 0,
      height: parseInt(videoStream.height) || 0,
      bitrate: parseInt(format.bit_rate) || 0,
      codec: videoStream.codec_name || 'unknown',
      format: format.format_name || 'unknown',
      fps:
        parseFloat(videoStream.r_frame_rate?.split('/')[0] || '0') /
        parseFloat(videoStream.r_frame_rate?.split('/')[1] || '1'),
      size: parseInt(format.size) || 0,
    };
  } catch (error) {
    throw new Error(`Failed to extract video metadata: ${error}`);
  }
};

// Generate thumbnail from video
export const generateThumbnail = async (
  inputPath: string,
  outputPath: string,
  time: string = '00:00:01'
): Promise<string> => {
  try {
    const command = `ffmpeg -i "${inputPath}" -ss ${time} -vframes 1 -q:v 2 "${outputPath}" -y`;
    await execAsync(command);
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error}`);
  }
};

// Transcode video to different resolution
export const transcodeVideo = async (
  options: VideoProcessingOptions
): Promise<VideoProcessingResult> => {
  const startTime = Date.now();

  try {
    // Ensure output directory exists
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build FFmpeg command
    const command = buildTranscodeCommand(options);

    // Execute FFmpeg command
    await executeFFmpegCommand(command);

    // Extract metadata from output file
    const metadata = await extractMetadata(options.outputPath);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      outputPath: options.outputPath,
      metadata,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    };
  }
};

// Build FFmpeg transcode command
const buildTranscodeCommand = (options: VideoProcessingOptions): string[] => {
  const args: string[] = ['-i', options.inputPath];

  // Set resolution
  if (options.resolution) {
    const resolutionMap = {
      '1080p': '1920:1080',
      '720p': '1280:720',
      '480p': '854:480',
    };
    args.push('-vf', `scale=${resolutionMap[options.resolution]}`);
  }

  // Set quality
  if (options.quality) {
    const qualityMap = {
      high: '18',
      medium: '23',
      low: '28',
    };
    args.push('-crf', qualityMap[options.quality]);
  }

  // Set format
  if (options.format) {
    args.push('-f', options.format);
  }

  // Add output path
  args.push(options.outputPath);

  return args;
};

// Execute FFmpeg command
const executeFFmpegCommand = async (args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    ffmpeg.stderr.on('data', data => {
      stderr += data.toString();
    });

    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', error => {
      reject(new Error(`FFmpeg error: ${error.message}`));
    });
  });
};

// Check if FFmpeg is available
export const checkFFmpegAvailability = async (): Promise<boolean> => {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
};

// Get supported video formats
export const getSupportedFormats = (): string[] => {
  return ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
};

// Get supported resolutions
export const getSupportedResolutions = (): string[] => {
  return ['1080p', '720p', '480p'];
};
