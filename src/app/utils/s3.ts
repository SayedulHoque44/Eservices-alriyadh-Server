/**
 * Thin wrappers around the AWS S3 SDK (v3).
 *
 * All Akama images live in S3 (see imageStorage.ts). Objects are uploaded without a public ACL: the bucket should block
 * public access, and images are only ever served through the API, which checks
 * the record's visibility on every request.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import config from "../config";

// Created on first use (settings are checked then, with a clear error)
let client: S3Client | null = null;

/** Returns the shared S3 client, creating it on first use. */
const getClient = () => {
  if (!client) {
    // A clear error beats a cryptic AWS one when settings are missing
    if (
      !config.aws_s3_bucket_name ||
      !config.aws_s3_bucket_region ||
      !config.aws_access_key ||
      !config.aws_secret_key
    ) {
      throw new Error(
        "S3 storage requires AWS_S3_BUCKET_NAME, AWS_S3_BUCKET_REGION, AWS_ACCESS_KEY and AWS_SECRET_KEY",
      );
    }
    client = new S3Client({
      region: config.aws_s3_bucket_region,
      credentials: {
        accessKeyId: config.aws_access_key,
        secretAccessKey: config.aws_secret_key,
      },
    });
  }
  return client;
};

/** Downloads a file as a stream (piped straight to the HTTP response). */
export const getS3Object = async (key: string) => {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: config.aws_s3_bucket_name, Key: key }),
  );
  return {
    body: result.Body as Readable,
    contentType: result.ContentType,
  };
};

/** Deletes a file. */
export const deleteS3Object = async (key: string) => {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: config.aws_s3_bucket_name, Key: key }),
  );
};

/**
 * Presigned PUT URL: lets the browser upload straight to S3 (same flow as the
 * previous project). The URL is valid for 5 minutes and only for this exact
 * key and Content-Type, so it cannot be reused for anything else.
 */
export const presignPutUrl = async (key: string, contentType: string) =>
  getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: config.aws_s3_bucket_name,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );

/** Size / type of an object, or null if it does not exist. */
export const headS3Object = async (key: string) => {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: config.aws_s3_bucket_name, Key: key }),
    );
    return { size: result.ContentLength ?? 0, contentType: result.ContentType };
  } catch {
    return null;
  }
};

/** Reads the first `length` bytes of an object (used to check the real file type). */
export const getS3Head = async (key: string, length: number) => {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: config.aws_s3_bucket_name,
      Key: key,
      Range: `bytes=0-${length - 1}`,
    }),
  );
  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as Readable) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};
