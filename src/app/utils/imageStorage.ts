/**
 * Image storage for Akama photos – AWS S3 only (private bucket, see s3.ts).
 *
 * Upload flow (same presigned-URL pattern as the previous project):
 *   1. browser asks createUploadTarget for a one-time PUT URL + key
 *   2. browser PUTs the file straight to S3
 *   3. browser sends the key when saving the record; verifyUploadedImage
 *      re-checks the stored file before the record may use it
 *
 * Used by Akama/akama.service.ts (verify / delete) and Akama/akama.routes.ts
 * (upload URL / read). Records store only the S3 key
 * (e.g. "eservices-alriyadh/akama/<timestamp>_<name>.png"), never a public URL.
 */
import { Readable } from "stream";
import httpStatus from "http-status";
import config from "../config";
import AppError from "../error/AppError";
import { deleteS3Object, getS3Head, getS3Object, headS3Object, presignPutUrl } from "./s3";

type TImageType = { ext: string; mime: string };

// Detect the real file type from its first bytes ("magic numbers") instead of
// trusting the browser-supplied mimetype or file name, which can be faked.
const detectImageType = (data: Buffer): TImageType | null => {
  // JPEG: FF D8 FF
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { ext: "png", mime: "image/png" };
  // WebP: "RIFF" .... "WEBP"
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
};

// Content-Type to send back when S3 does not report one
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Extension used in the key for each accepted upload type
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Keys look like "<folderName>/<timestamp>_<fileName>" (folder = one or more
// path parts). Only safe characters are allowed, so "../" tricks are impossible.
const KEY_PATTERN =
  /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/;

/** True if `key` has the expected "<folder>/<file>.<ext>" shape. */
export const isValidImageKey = (key: string) => KEY_PATTERN.test(key);

/** Upload limit in bytes (MAX_UPLOAD_MB). */
export const maxUploadBytes = () => config.max_upload_mb * 1024 * 1024;

/**
 * Step 1: validate the announced file and hand out a presigned S3 PUT URL + key.
 * Same pattern as the previous project: the client sends folderName + fileName,
 * the key is `${folderName}/${Date.now()}_${fileName}`.
 */
export const createUploadTarget = async (input: {
  fileName: string;
  fileType: string;
  fileSize: number;
  folderName?: string;
}) => {
  const { fileName, fileType, fileSize } = input;
  const ext = MIME_TO_EXT[fileType];
  if (!ext) {
    throw new AppError(httpStatus.UNSUPPORTED_MEDIA_TYPE, "Only JPG, PNG and WebP images are allowed.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Please choose an image file.");
  }
  if (fileSize > maxUploadBytes()) {
    throw new AppError(
      httpStatus.REQUEST_ENTITY_TOO_LARGE,
      `Image is too large. Maximum size is ${config.max_upload_mb} MB.`,
    );
  }
  // Spaces -> "_", anything unsafe -> "_", extension taken from the real type
  const baseName =
    fileName
      .replace(/\.[^.]*$/, "")
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 80) || "image";
  const folder = input.folderName || config.aws_s3_prefix;
  const key = `${folder}/${Date.now()}_${baseName}.${ext}`;
  if (!isValidImageKey(key)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid folder name.");
  }
  const presignedUrl = await presignPutUrl(key, fileType);
  return { presignedUrl, Key: key };
};

/**
 * Step 3: confirm the key points at a real, small-enough JPG/PNG/WebP in S3.
 * Deletes the object when it fails, so rejected uploads do not pile up.
 */
export const verifyUploadedImage = async (key: string) => {
  if (!isValidImageKey(key)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid image key.");
  const meta = await headS3Object(key);
  if (!meta) {
    throw new AppError(httpStatus.BAD_REQUEST, "The uploaded image was not found. Please upload it again.");
  }
  const head = await getS3Head(key, 12);
  if (meta.size > maxUploadBytes() || !detectImageType(head)) {
    await deleteImageSafely(key);
    throw new AppError(httpStatus.BAD_REQUEST, "The uploaded file is not a valid image.");
  }
};

/** Opens a stored image for streaming. Throws if it does not exist. */
export const readImage = async (
  key: string,
): Promise<{ body: Readable; contentType: string }> => {
  const fallbackType = MIME_BY_EXT[key.split(".").pop() || ""] || "application/octet-stream";
  const { body, contentType } = await getS3Object(key);
  return { body, contentType: contentType || fallbackType };
};

/** Best-effort delete: a leftover file must never break the database operation. */
export const deleteImageSafely = async (key?: string) => {
  if (!key) return;
  try {
    await deleteS3Object(key);
  } catch (error) {
    // Only logged: the record change already succeeded, the file is just an orphan
    // eslint-disable-next-line no-console
    console.error(`Could not delete image "${key}". Remove it manually.`, error);
  }
};
