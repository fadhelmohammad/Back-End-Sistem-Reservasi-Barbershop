// middleware/uploadMiddleware.js
const multer = require('multer');

// Use memory storage untuk manual upload
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Check if file exists and has mimetype
  if (!file || !file.mimetype) {
    cb(new Error('Invalid file'), false);
    return;
  }

  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;