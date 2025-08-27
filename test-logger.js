const logger = require('./dist/config/logger.config').default;

console.log('Testing Winston Logger...');

// Test different log levels
logger.info('This is an info message');
logger.warn('This is a warning message');
logger.error('This is an error message');
logger.debug('This is a debug message');

// Test component loggers
const {
  backgroundJobLogger,
  thumbnailWorkerLogger,
} = require('./dist/config/logger.config');

backgroundJobLogger.info('Background job system starting up');
thumbnailWorkerLogger.info('Thumbnail worker initialized');
thumbnailWorkerLogger.error('Test error in thumbnail worker', {
  error: 'Test error message',
  stack: 'Test stack trace',
});

console.log(
  'Logger test completed. Check the logs directory for output files.'
);
