import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

// AWS S3 client configuration
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
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
    return process.env.PRIVATE_OBJECT_DIR || "private/";
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

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const objectKey = `${privateObjectDir}uploads/${objectId}`;

    // Generate presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    try {
      const signedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 900 // 15 minutes
      });
      return signedUrl;
    } catch (error) {
      console.error('Error generating S3 presigned URL:', error);
      throw new Error('Failed to generate upload URL');
    }
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
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectKey = `${entityDir}${entityId}`;
    
    const s3Object = new S3Object(this.bucketName, objectKey, s3Client);
    const [exists] = await s3Object.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return s3Object;
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
        if (objectKey.startsWith(privateDir)) {
          const entityId = objectKey.slice(privateDir.length);
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
}