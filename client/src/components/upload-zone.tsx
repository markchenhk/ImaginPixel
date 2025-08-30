import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FileImage, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface UploadZoneProps {
  onImageUpload: (file: File) => void;
  isUploading?: boolean;
  className?: string;
}

export default function UploadZone({ onImageUpload, isUploading = false, className }: UploadZoneProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragActive(false);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let message = 'File upload failed';
      
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        message = 'File too large. Maximum size is 10MB.';
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        message = 'Invalid file type. Only JPG, PNG, and WebP are supported.';
      }
      
      toast({
        title: 'Upload Error',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    if (acceptedFiles.length > 0) {
      onImageUpload(acceptedFiles[0]);
    }
  }, [onImageUpload, toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "upload-zone rounded-lg p-6 text-center transition-all duration-300 cursor-pointer",
        "border-2 border-dashed border-border hover:border-blue-500 hover:bg-blue-500/5",
        dragActive && "drag-active",
        isUploading && "opacity-50 cursor-not-allowed",
        className
      )}
      data-testid="upload-zone"
    >
      <input {...getInputProps()} data-testid="file-input" />
      
      <div className="flex flex-col items-center gap-3">
        {isUploading ? (
          <>
            <div className="processing-animation w-8 h-8 rounded-full" />
            <p className="text-sm text-muted-foreground">Uploading image...</p>
          </>
        ) : (
          <>
            {isDragActive ? (
              <FileImage className="w-8 h-8 text-blue-500" />
            ) : (
              <CloudUpload className="w-8 h-8 text-muted-foreground" />
            )}
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {isDragActive ? 'Drop your image here' : 'Drag & drop an image here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or{' '}
                <Button
                  variant="link"
                  className="h-auto p-0 text-blue-500 hover:underline text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    open();
                  }}
                  data-testid="browse-files-button"
                >
                  browse files
                </Button>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG, PNG, WebP up to 10MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
