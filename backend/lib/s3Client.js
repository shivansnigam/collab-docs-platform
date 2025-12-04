import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


const region = process.env.S3_REGION || 'us-east-1';


export const s3 = new S3Client({
region,
endpoint: process.env.S3_ENDPOINT || undefined,  
credentials: {
accessKeyId: process.env.S3_ACCESS_KEY_ID,
secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
},
forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
});


export const getPresignedPutUrl = async (Bucket, Key, ContentType, expiresSeconds = 60 * 5) => {
const command = new PutObjectCommand({ Bucket, Key, ContentType });
return await getSignedUrl(s3, command, { expiresIn: expiresSeconds });
};


export const getPresignedGetUrl = async (Bucket, Key, expiresSeconds = 60 * 5) => {
const command = new GetObjectCommand({ Bucket, Key });
return await getSignedUrl(s3, command, { expiresIn: expiresSeconds });
};