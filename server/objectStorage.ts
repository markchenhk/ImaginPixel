import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// AWS S3 client configuration with credential validation
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
  },
});

// Alternative S3 client with different configuration
export const s3ClientAlt = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
  maxAttempts: 3,
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// S3 Object wrapper to mimic Google Cloud Storage File interface
export class S3Object {
  constructor(
    public bucketName: string,
    public objectName: string,
    private s3Client: S3Client
  ) {}

  get name(): string {
    return this.objectName;
  }

  async exists(): Promise<[boolean]> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
      }));
      return [true];
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return [false];
      }
      throw error;
    }
  }

  async getMetadata(): Promise<[any]> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectName,
      });
      const response = await this.s3Client.send(command);
      
      return [{
        contentType: response.ContentType,
        size: response.ContentLength?.toString(),
        metadata: response.Metadata || {},
      }];
    } catch (error) {
      console.error('Error getting S3 object metadata:', error);
      throw error;
    }
  }

  async setMetadata(metadata: { metadata: Record<string, string> }): Promise<void> {
    // For S3, we need to copy the object with new metadata
    // This is a simplified implementation - in production you might want to handle this differently
    console.log('Setting metadata for S3 object:', this.objectName, metadata);
    // Note: S3 metadata updates require copying the object, which is more complex
    // For now, we'll store ACL policies in a separate system or use S3 tags
  }

  createReadStream() {
    // Return a readable stream for the S3 object
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: this.objectName,
    });

    // Create a stream-like interface
    return {
      pipe: (res: Response) => {
        this.s3Client.send(command).then((response) => {
          if (response.Body) {
            // @ts-ignore - Body is a readable stream in Node.js
            response.Body.pipe(res);
          }
        }).catch((error) => {
          console.error('Error streaming S3 object:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming file' });
          }
        });
      },
      on: (event: string, callback: Function) => {
        // Handle stream events if needed
        if (event === 'error') {
          // Error handling
        }
      }
    };
  }
}

// The object storage service using AWS S3
export class ObjectStorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
    if (!this.bucketName) {
      throw new Error(
        "AWS_S3_BUCKET_NAME environment variable is required for S3 integration"
      );
    }
    
    console.log('S3 Configuration:', {
      bucketName: this.bucketName,
      region: process.env.AWS_REGION,
      hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
    });
    
    // Test S3 connection
    this.testS3Connection();
  }

  // Comprehensive S3 diagnostics and permission testing
  private async testS3Connection() {
    console.log('=== S3 DIAGNOSTICS ===');
    console.log('Testing S3 bucket connectivity and permissions...');
    
    // Test 1: Check bucket accessibility
    try {
      console.log('Test 1: Checking bucket accessibility...');
      const command = new HeadBucketCommand({ Bucket: this.bucketName });
      await s3Client.send(command);
      console.log('✓ Bucket is accessible');
    } catch (error: any) {
      console.log('✗ Bucket access failed:', error.message);
    }
    
    // Test 2: Test upload permissions with a small test file
    try {
      console.log('Test 2: Testing upload permissions...');
      const testKey = 'test-upload-permissions.txt';
      const testContent = 'This is a test file to verify S3 upload permissions.';
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
        ACL: 'private'
      });

      await s3Client.send(uploadCommand);
      console.log('✓ Upload permissions working - test file uploaded successfully');
      
      // Clean up test file
      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: testKey
        }));
        console.log('✓ Test file cleaned up');
      } catch (cleanupError) {
        console.log('⚠ Test file cleanup failed (but upload worked)');
      }
      
    } catch (error: any) {
      console.error('✗ Upload permissions test failed:', {
        name: error.name,
        message: error.message,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode
      });
      
      // Provide specific guidance
      if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        console.error('\n🔧 FIX REQUIRED: Add this policy to your IAM user:');
        console.error(JSON.stringify({
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:HeadBucket",
                "s3:ListBucket"
              ],
              "Resource": [
                `arn:aws:s3:::${this.bucketName}`,
                `arn:aws:s3:::${this.bucketName}/*`
              ]
            }
          ]
        }, null, 2));
      }
    }
    
    // Test 3: Direct HTTP access (fallback verification)
    try {
      console.log('Test 3: Direct HTTP access...');
      await this.testDirectHttpAccess();
      console.log('✓ Direct HTTP access working');
    } catch (error: any) {
      console.log('✗ Direct HTTP access failed:', error.message);
    }
    
    console.log('=== END S3 DIAGNOSTICS ===');
  }
  
  // Test direct HTTP access to S3
  private async testDirectHttpAccess() {
    const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Replit-AI-Image-Editor/1.0'
      }
    });
    
    if (response.status === 200 || response.status === 403) {
      // 403 is expected for HEAD requests on buckets without public access
      // but it confirms the bucket exists and is reachable
      return true;
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    // For S3, we'll use prefixes instead of full paths
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "public/";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "private/";
    // Remove leading slash and ensure trailing slash
    return dir.startsWith('/') ? dir.slice(1) : dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<S3Object | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}${filePath}`;
      const s3Object = new S3Object(this.bucketName, fullPath, s3Client);

      // Check if file exists
      const [exists] = await s3Object.exists();
      if (exists) {
        return s3Object;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: S3Object, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // For S3, we'll implement a simpler ACL check
      const isPublic = true; // Simplified for now - can be enhanced with proper ACL
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity with fallback approaches
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    // Ensure proper path joining with slash separator
    const uploadsDir = privateObjectDir.endsWith('/') ? privateObjectDir : `${privateObjectDir}/`;
    const objectKey = `${uploadsDir}uploads/${objectId}`;

    // Try multiple approaches for generating presigned URL
    const approaches = [
      { name: 'Standard S3 Client', client: s3Client },
      { name: 'Path-style S3 Client', client: s3ClientAlt }
    ];
    
    for (const approach of approaches) {
      try {
        console.log(`Trying presigned URL generation with: ${approach.name}`);
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          ContentType: 'application/octet-stream'
        });

        const signedUrl = await getSignedUrl(approach.client, command, { 
          expiresIn: 900 // 15 minutes
        });
        
        console.log(`✓ Successfully generated presigned URL with: ${approach.name}`);
        return signedUrl;
      } catch (error: any) {
        console.log(`✗ ${approach.name} failed:`, error.message);
        continue;
      }
    }
    
    // If all approaches fail, try direct upload approach
    throw new Error('All presigned URL generation approaches failed. Check AWS credentials and permissions.');
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<S3Object> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    const privateDir = this.getPrivateObjectDir();
    // Ensure proper path joining
    const entityDir = privateDir.endsWith('/') ? privateDir : `${privateDir}/`;
    const objectKey = `${entityDir}${entityId}`;
    
    console.log(`Looking for S3 object: ${objectKey}`);
    
    // Try with different S3 clients
    const clients = [s3Client, s3ClientAlt];
    
    for (const client of clients) {
      try {
        const s3Object = new S3Object(this.bucketName, objectKey, client);
        const [exists] = await s3Object.exists();
        if (exists) {
          console.log(`✓ Found object with client: ${objectKey}`);
          return s3Object;
        }
      } catch (error) {
        console.log('Failed to check object with client, trying next...');
        continue;
      }
    }
    
    console.log(`✗ Object not found: ${objectKey}`);
    throw new ObjectNotFoundError();
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Handle S3 URLs
    if (rawPath.includes('amazonaws.com') || rawPath.includes('s3')) {
      try {
        const url = new URL(rawPath);
        const pathname = url.pathname;
        
        // Extract object key from S3 URL
        let objectKey = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        
        // Remove bucket name if it's at the start of the path
        if (objectKey.startsWith(`${this.bucketName}/`)) {
          objectKey = objectKey.slice(`${this.bucketName}/`.length);
        }
        
        const privateDir = this.getPrivateObjectDir();
        const privateDirWithSlash = privateDir.endsWith('/') ? privateDir : `${privateDir}/`;
        
        if (objectKey.startsWith(privateDirWithSlash)) {
          const entityId = objectKey.slice(privateDirWithSlash.length);
          return `/objects/${entityId}`;
        }
      } catch (error) {
        console.error('Error parsing S3 URL:', error);
      }
    }
    
    return rawPath;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    try {
      const objectFile = await this.getObjectEntityFile(normalizedPath);
      // For S3, we'll store ACL policies in a separate system (database or S3 tags)
      // This is a simplified implementation
      console.log(`Setting ACL policy for ${normalizedPath}:`, aclPolicy);
      // await setObjectAclPolicy(objectFile, aclPolicy);
      return normalizedPath;
    } catch (error) {
      console.error('Error setting ACL policy:', error);
      return normalizedPath;
    }
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: S3Object;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    // Simplified ACL check for S3 - in production you'd implement proper ACL
    return true; // Allow all access for now
  }

  // Direct upload to S3 with detailed error diagnosis
  async directUploadToS3(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    console.log('Attempting direct S3 upload with AWS SDK...');
    
    const privateObjectDir = this.getPrivateObjectDir();
    // Ensure proper path joining with slash separator
    const uploadsDir = privateObjectDir.endsWith('/') ? privateObjectDir : `${privateObjectDir}/`;
    const objectKey = `${uploadsDir}uploads/${randomUUID()}-${fileName}`;
    console.log(`Target S3 path: s3://${this.bucketName}/${objectKey}`);
    
    try {
      console.log('Trying direct upload with standard S3 client...');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'private', // Explicitly set ACL
      });

      const result = await s3Client.send(command);
      console.log('✓ Direct S3 upload successful!', {
        ETag: result.ETag,
        VersionId: result.VersionId,
        Location: `s3://${this.bucketName}/${objectKey}`
      });
      
      return `/objects/${objectKey.replace(this.getPrivateObjectDir(), '')}`;
    } catch (error: any) {
      console.error('✗ Direct S3 upload failed with detailed error:', {
        name: error.name,
        message: error.message,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        region: process.env.AWS_REGION,
        bucket: this.bucketName,
        key: objectKey
      });
      
      // Try to provide specific guidance based on error
      if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        throw new Error(`S3 Access Denied: IAM user needs s3:PutObject permission for bucket "${this.bucketName}"`);
      } else if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket "${this.bucketName}" does not exist in region "${process.env.AWS_REGION}"`);
      } else if (error.name === 'InvalidAccessKeyId') {
        throw new Error('Invalid AWS Access Key ID');
      } else if (error.name === 'SignatureDoesNotMatch') {
        throw new Error('Invalid AWS Secret Access Key');
      } else if (error.name === 'TokenRefreshRequired') {
        throw new Error('AWS credentials have expired');
      }
      
      throw error;
    }
  }

  // Fallback: Use local file storage
  async fallbackToLocalStorage(fileBuffer: Buffer, fileName: string): Promise<string> {
    console.log('Using local storage fallback...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const uniqueFileName = `${randomUUID()}-${fileName}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    fs.writeFileSync(filePath, fileBuffer);
    
    console.log('✓ File saved to local storage:', filePath);
    return `/uploads/${uniqueFileName}`;
  }
  
  // S3-only upload method - no fallbacks
  async uploadToS3(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
    console.log('Starting S3-only upload (no fallbacks)...');
    
    // Only try direct S3 upload
    return await this.directUploadToS3(fileBuffer, fileName, contentType);
  }
}