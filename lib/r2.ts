import { S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  appFolder: string;
  endpoint: string;
};

let r2ClientSingleton: S3Client | null = null;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Mungon ${name} ne .env.`);
  }

  return value;
}

function sanitizeFileSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function sanitizeFolder(value: string) {
  return value
    .split("/")
    .map((segment) => sanitizeFileSegment(segment))
    .filter(Boolean)
    .join("/");
}

export function getR2Config(): R2Config {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucketName = requiredEnv("R2_BUCKET_NAME");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const appFolder = sanitizeFolder(process.env.R2_APP_FOLDER?.trim() || "stockbase");

  return {
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    appFolder,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function getR2Client() {
  if (r2ClientSingleton) {
    return r2ClientSingleton;
  }

  const config = getR2Config();

  r2ClientSingleton = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return r2ClientSingleton;
}

export function buildAppAssetUrl(key: string) {
  const safePath = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/assets/${safePath}`;
}
