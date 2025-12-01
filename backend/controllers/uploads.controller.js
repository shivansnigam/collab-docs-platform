// controllers/uploads.controller.js

import File from '../models/File.js';
import { getPresignedPutUrl, getPresignedGetUrl, s3 } from '../lib/s3Client.js';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import * as analytics from '../services/analytics.service.js'; // <-- added for analytics tracking

const BUCKET = process.env.S3_BUCKET;

// 1) Generate presigned PUT URL (frontend → direct upload to S3)
export const signUpload = async (req, res, next) => {
  try {
    const { filename, contentType, size, workspaceId, documentId } = req.body;
    if (!filename || !contentType) return res.status(400).json({ message: 'filename & contentType required' });

    // validation: size limit
    const maxBytes = parseInt(process.env.MAX_UPLOAD_BYTES || '10485760');
    if (size && size > maxBytes) return res.status(413).json({ message: 'File too large' });

    const storageKey = `${req.user.userId}/${Date.now()}-${nanoid()}-${filename}`;

    // create DB record (pending)
    const fileDoc = await File.create({
      workspace: workspaceId || null,
      document: documentId || null,
      uploader: req.user.userId,
      originalName: filename,
      storageKey,
      mime: contentType,
      size: size || 0,
      status: 'pending'
    });

    const uploadUrl = await getPresignedPutUrl(BUCKET, storageKey, contentType, parseInt(process.env.S3_PRESIGN_EXPIRES || '300'));

    // NOTE: we don't increment uploads here because actual upload happens client->S3.
    // If you prefer to count 'initiated' uploads, you can push an activity instead.
    // Example (optional): await analytics.pushActivity({ workspaceId, docId: documentId, userId: req.user.userId, action: 'upload_initiated', meta: { fileId: fileDoc._id } });

    return res.json({ file: { id: fileDoc._id, storageKey }, uploadUrl, expiresIn: parseInt(process.env.S3_PRESIGN_EXPIRES || '300') });
  } catch (err) {
    next(err);
  }
};

// 2) Server-side proxy upload (multer memory) -> upload to S3
export const proxyUpload = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'file required' });

    const storageKey = `${req.user.userId}/${Date.now()}-${nanoid()}-${file.originalname}`;

    // upload buffer to s3
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: storageKey, Body: file.buffer, ContentType: file.mimetype });
    await s3.send(cmd);

    const fileDoc = await File.create({
      workspace: req.body.workspaceId || null,
      document: req.body.documentId || null,
      uploader: req.user.userId,
      originalName: file.originalname,
      storageKey,
      mime: file.mimetype,
      size: file.size,
      status: 'uploaded'
    });

    // analytics: increment uploads count (workspace-level) and record activity
    try {
      const wsId = fileDoc.workspace || req.body.workspaceId || null;
      if (wsId) {
        await analytics.incUploads(wsId, req.user.userId, fileDoc.document || null, fileDoc._id, 1);
      } else {
        // still record activity without workspace if you want (optional)
        await analytics.pushActivity({ workspaceId: null, docId: fileDoc.document || null, userId: req.user.userId, action: 'upload', meta: { fileId: fileDoc._id } });
      }
    } catch (e) {
      // do not block upload response on analytics error
      console.error('analytics.proxyUpload error', e);
    }

    // optional: return presigned GET for immediate display
    const getUrl = await getPresignedGetUrl(BUCKET, storageKey, parseInt(process.env.S3_PRESIGN_EXPIRES || '300'));

    return res.status(201).json({ file: fileDoc, url: getUrl });
  } catch (err) {
    next(err);
  }
};

// 3) Get fresh signed GET URL for an existing file id
export const getSignedUrlForFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // permission check: member of workspace or uploader - simple rule
    // you can integrate requireWorkspaceMember middleware when needed
    if (file.workspace) {
      // leave check to caller or add logic here
    }

    const url = await getPresignedGetUrl(process.env.S3_BUCKET, file.storageKey, parseInt(process.env.S3_PRESIGN_EXPIRES || '300'));
    return res.json({ url, expiresIn: parseInt(process.env.S3_PRESIGN_EXPIRES || '300') });
  } catch (err) {
    next(err);
  }
};

// 4) Confirm upload (client calls this AFTER successful client->S3 upload)
//    This updates the DB record from 'pending' -> 'uploaded', verifies the object exists in S3,
//    and increments analytics counters. Frontend should call this once upload to S3 succeeds.
export const confirmUpload = async (req, res, next) => {
  try {
    const { fileId, storageKey, workspaceId, documentId, size } = req.body;

    if (!fileId && !storageKey) return res.status(400).json({ message: 'fileId or storageKey required' });

    // locate the DB record
    let fileDoc = null;
    if (fileId) fileDoc = await File.findById(fileId);
    if (!fileDoc && storageKey) fileDoc = await File.findOne({ storageKey });
    if (!fileDoc) return res.status(404).json({ message: 'File record not found' });

    // verify object exists in S3 (HeadObject)
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileDoc.storageKey }));
    } catch (headErr) {
      // if object doesn't exist, inform client
      console.error('S3 HeadObject error verifying uploaded object', headErr);
      return res.status(400).json({ message: 'Uploaded object not found in storage' });
    }

    // update DB record
    fileDoc.status = 'uploaded';
    if (workspaceId) fileDoc.workspace = workspaceId;
    if (documentId) fileDoc.document = documentId;
    if (size) fileDoc.size = size;
    await fileDoc.save();

    // analytics: increment uploads count (workspace-level) and record activity
    try {
      const wsId = fileDoc.workspace || workspaceId || null;
      if (wsId) {
        await analytics.incUploads(wsId, req.user.userId, fileDoc.document || documentId || null, fileDoc._id, 1);
      } else {
        await analytics.pushActivity({ workspaceId: null, docId: fileDoc.document || documentId || null, userId: req.user.userId, action: 'upload', meta: { fileId: fileDoc._id } });
      }
    } catch (e) {
      console.error('analytics.confirmUpload error', e);
    }

    // return updated record (and optional GET URL)
    const getUrl = await getPresignedGetUrl(BUCKET, fileDoc.storageKey, parseInt(process.env.S3_PRESIGN_EXPIRES || '300'));

    return res.status(200).json({ file: fileDoc, url: getUrl });
  } catch (err) {
    next(err);
  }
};
