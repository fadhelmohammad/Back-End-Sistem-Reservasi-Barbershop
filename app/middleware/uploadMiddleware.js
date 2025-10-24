// middleware/uploadMiddleware.js
const multer = require('multer');
const { storage } = require('../config/cloudinary');

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa gambar (jpg, jpeg, png, webp)'), false);
    }
  },
});

const uploadBarberPhoto = upload.single('photo');

const handleUpload = (req, res, next) => {
  uploadBarberPhoto(req, res, (err) => {
    console.log('Multer middleware - req.body:', req.body);
    console.log('Multer middleware - req.file:', req.file);
    
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File terlalu besar. Maksimal 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Error upload file',
        error: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    next();
  });
};

module.exports = { handleUpload };