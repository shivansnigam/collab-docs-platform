import multer from 'multer';


const storage = multer.memoryStorage(); // small files only; for big files use streaming
const upload = multer({
storage,
limits: { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || '10485760') }, // default 10MB
fileFilter: (req, file, cb) => {
// basic whitelist (you can expand)
const allowed = ['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
if (!allowed.includes(file.mimetype)) return cb(new Error('File type not allowed'), false);
cb(null, true);
}
});


export default upload;