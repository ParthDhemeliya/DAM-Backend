import multer from 'multer';

// Configure multer for file uploads
const upload = multer({ dest: '/tmp/uploads' });

export { upload };
