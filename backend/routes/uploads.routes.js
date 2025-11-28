import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';
import { signUpload, proxyUpload, getSignedUrlForFile } from '../controllers/uploads.controller.js';


const router = express.Router();


// presigned flow
router.post('/sign', authMiddleware, signUpload);


// server-proxy flow (multipart/form-data)
router.post('/', authMiddleware, upload.single('file'), proxyUpload);


// get fresh GET url
router.get('/:id/signed-url', authMiddleware, getSignedUrlForFile);


export default router;