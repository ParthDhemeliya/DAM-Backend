import {
  validateString,
  validateNumber,
  validateInteger,
} from '../middleware/validation'

// Job type validation
export const validateJobType = (jobType: string): void => {
  const validJobTypes = [
    'thumbnail',
    'metadata',
    'conversion',
    'video_metadata',
    'video_transcode',
    'audio_metadata',
    'audio_conversion',
    'cleanup',
  ]

  if (!validJobTypes.includes(jobType)) {
    throw new Error(
      `Invalid job type. Must be one of: ${validJobTypes.join(', ')}`
    )
  }
}

// Job status validation
export const validateJobStatus = (status: string): void => {
  const validStatuses = [
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
  ]
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid job status. Must be one of: ${validStatuses.join(', ')}`
    )
  }
}

// Job priority validation
export const validateJobPriority = (priority: number): void => {
  validateInteger(priority, 'priority', 1)

  if (priority < 1 || priority > 10) {
    throw new Error('Job priority must be between 1 and 10')
  }
}

// Job progress validation
export const validateJobProgress = (progress: number): void => {
  validateNumber(progress, 'progress', 0)

  if (progress < 0 || progress > 100) {
    throw new Error('Job progress must be between 0 and 100')
  }
}

// Asset ID validation for jobs
export const validateJobAssetId = (assetId: number): void => {
  validateInteger(assetId, 'asset_id', 1)
}

// Job input data validation
export const validateJobInputData = (inputData: any): void => {
  if (inputData && typeof inputData !== 'object') {
    throw new Error('Job input_data must be an object or null')
  }
}

// Job output data validation
export const validateJobOutputData = (outputData: any): void => {
  if (outputData && typeof outputData !== 'object') {
    throw new Error('Job output_data must be an object or null')
  }
}

// Job error message validation
export const validateJobErrorMessage = (errorMessage: string): void => {
  if (errorMessage && typeof errorMessage !== 'string') {
    throw new Error('Job error_message must be a string or null')
  }

  if (errorMessage && errorMessage.length > 1000) {
    throw new Error('Job error_message too long (maximum 1000 characters)')
  }
}

// Job options validation based on job type
export const validateJobOptions = (jobType: string, options: any): void => {
  if (!options || typeof options !== 'object') {
    return // Options are optional
  }

  switch (jobType) {
    case 'thumbnail':
      validateThumbnailOptions(options)
      break
    case 'conversion':
      validateConversionOptions(options)
      break
    case 'video_transcode':
      validateVideoTranscodeOptions(options)
      break
    case 'audio_conversion':
      validateAudioConversionOptions(options)
      break
  }
}

// Thumbnail generation options validation
const validateThumbnailOptions = (options: any): void => {
  if (options.size) {
    const sizeRegex = /^\d+x\d+$/
    if (!sizeRegex.test(options.size)) {
      throw new Error(
        'Thumbnail size must be in format: widthxheight (e.g., 300x300)'
      )
    }
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    throw new Error('Thumbnail quality must be between 1 and 100')
  }
}

// File conversion options validation
const validateConversionOptions = (options: any): void => {
  if (options.targetFormat) {
    const validFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp', 'tiff']
    if (!validFormats.includes(options.targetFormat.toLowerCase())) {
      throw new Error(
        `Invalid target format for conversion. Must be one of: ${validFormats.join(', ')}`
      )
    }
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    throw new Error('Conversion quality must be between 1 and 100')
  }
}

// Video transcoding options validation
const validateVideoTranscodeOptions = (options: any): void => {
  if (options.resolutions) {
    if (!Array.isArray(options.resolutions)) {
      throw new Error('Video resolutions must be an array')
    }

    const validResolutions = [
      '240p',
      '360p',
      '480p',
      '720p',
      '1080p',
      '1440p',
      '2160p',
    ]
    for (const resolution of options.resolutions) {
      if (!validResolutions.includes(resolution)) {
        throw new Error(
          `Invalid video resolution. Must be one of: ${validResolutions.join(', ')}`
        )
      }
    }
  }

  if (options.bitrate && (options.bitrate < 1000 || options.bitrate > 50000)) {
    throw new Error('Video bitrate must be between 1000 and 50000 kbps')
  }
}

// Audio conversion options validation
const validateAudioConversionOptions = (options: any): void => {
  if (options.targetFormat) {
    const validFormats = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']
    if (!validFormats.includes(options.targetFormat.toLowerCase())) {
      throw new Error(
        `Invalid target format for audio conversion. Must be one of: ${validFormats.join(', ')}`
      )
    }
  }

  if (options.bitrate && (options.bitrate < 32 || options.bitrate > 320)) {
    throw new Error('Audio bitrate must be between 32 and 320 kbps')
  }

  if (
    options.sampleRate &&
    ![8000, 11025, 16000, 22050, 32000, 44100, 48000].includes(
      options.sampleRate
    )
  ) {
    throw new Error(
      'Invalid sample rate. Must be one of: 8000, 11025, 16000, 22050, 32000, 44100, 48000'
    )
  }
}
