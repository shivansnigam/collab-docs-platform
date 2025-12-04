import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../lib/s3Client.js';
import File from '../models/File.js';

export const streamFileById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) return res.status(404).send('File not found');

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: file.storageKey
    });

    const data = await s3.send(command);

    res.setHeader("Content-Type", file.mime || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year

    data.Body.pipe(res);
  } catch (err) {
    console.error("streamFileById error", err);
    return res.status(500).send("Could not stream file");
  }
};
