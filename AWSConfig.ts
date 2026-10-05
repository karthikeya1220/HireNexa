import { S3Client } from "@aws-sdk/client-s3"

// Server-only AWS S3 configuration — credentials never leave the server,
// so these must NOT use the NEXT_PUBLIC_ prefix.
const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  }
}

// Initialize S3 client
const s3Client = new S3Client(s3Config)

// Bucket name
const bucketName = process.env.S3_BUCKET_NAME || "ats-checker-bucket"

export { s3Client, bucketName }
