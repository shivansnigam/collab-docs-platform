import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';
import { signUpload, proxyUpload, getSignedUrlForFile } from '../controllers/uploads.controller.js';
import { confirmUpload } from "../controllers/uploads.controller.js";
import { streamFileById } from '../controllers/files.controller.js';

const router = express.Router();


// presigned flow
router.post('/sign', authMiddleware, signUpload);


// server-proxy flow (multipart/form-data)
router.post('/', authMiddleware, upload.single('file'), proxyUpload);
router.post("/confirm", authMiddleware, confirmUpload);


// get fresh GET url
router.get('/:id/signed-url', authMiddleware, getSignedUrlForFile);
router.get('/file/:id', streamFileById);  

export default router;