import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, FileImage, AlertCircle, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MultipleImageUploadProps {
  onImagesUpload: (files: File[]) => void;
  isUploading?: boolean;
  className?: string;
  maxImages?: number;
}

interface UploadedImagePreview {
  file: File;
  url: string;
}

export default function MultipleImageUpload({ 
  onImagesUpload, 
  isUploading = false, 
  className,
  maxImages = 10
}: MultipleImageUploadProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImagePreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragActive(false);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let message = 'File upload failed';
      
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        message = 'File too large. Maximum size is 10MB per image.';
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

    // Check if adding new files would exceed the limit
    if (uploadedImages.length + acceptedFiles.length > maxImages) {
      toast({
        title: 'Too Many Images',
        description: `Maximum ${maxImages} images allowed. You can only add ${maxImages - uploadedImages.length} more.`,
        variant: 'destructive',
      });
      return;
    }

    if (acceptedFiles.length > 0) {
      // Create preview URLs for the new images
      const newImages = acceptedFiles.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      
      const updatedImages = [...uploadedImages, ...newImages];
      setUploadedImages(updatedImages);
      
      // Call the parent callback with all files
      onImagesUpload(updatedImages.map(img => img.file));
    }
  }, [onImagesUpload, toast, uploadedImages, maxImages]);

  const removeImage = useCallback((index: number) => {
    const updatedImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(updatedImages);
    onImagesUpload(updatedImages.map(img => img.file));
    
    // Clean up the URL object
    URL.revokeObjectURL(uploadedImages[index].url);
  }, [uploadedImages, onImagesUpload]);

  const clearAllImages = useCallback(() => {
    // Clean up all URL objects
    uploadedImages.forEach(img => URL.revokeObjectURL(img.url));
    setUploadedImages([]);
    onImagesUpload([]);
  }, [uploadedImages, onImagesUpload]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB per file
    multiple: true,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    disabled: isUploading || uploadedImages.length >= maxImages
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "upload-zone rounded-lg p-6 text-center transition-all duration-300 cursor-pointer",
          "border-2 border-dashed border-border hover:border-blue-500 hover:bg-blue-500/5",
          dragActive && "drag-active border-blue-500 bg-blue-500/10",
          (isUploading || uploadedImages.length >= maxImages) && "opacity-50 cursor-not-allowed",
          className
        )}
        data-testid="multiple-upload-zone"
      >
        <input {...getInputProps()} data-testid="multiple-file-input" />
        
        <div className="flex flex-col items-center gap-3">
          {isUploading ? (
            <>
              <div className="processing-animation w-8 h-8 rounded-full" />
              <p className="text-sm text-foreground">Uploading images...</p>
            </>
          ) : uploadedImages.length >= maxImages ? (
            <>
              <AlertCircle className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-sm text-foreground font-medium">Maximum images reached</p>
                <p className="text-xs text-muted-foreground">
                  Remove some images to add more
                </p>
              </div>
            </>
          ) : (
            <>
              <CloudUpload className={cn(
                "w-8 h-8 transition-colors",
                dragActive ? "text-blue-500" : "text-muted-foreground"
              )} />
              <div>
                <p className="text-sm text-foreground mb-1">
                  <span className="font-medium">Drag & drop multiple images here</span> or{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-blue-500 hover:text-blue-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    data-testid="browse-multiple-files-button"
                  >
                    browse files
                  </Button>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, WebP up to 10MB each ({uploadedImages.length}/{maxImages} images)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Previews */}
      {uploadedImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Uploaded Images ({uploadedImages.length})
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllImages}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
              data-testid="clear-all-images"
            >
              Clear All
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {uploadedImages.map((image, index) => (
              <div 
                key={index} 
                className="relative group rounded-lg overflow-hidden border border-border bg-background"
                data-testid={`image-preview-${index}`}
              >
                <div className="aspect-square relative">
                  <img
                    src={image.url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 w-6 h-6 p-0 bg-red-600/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                      data-testid={`remove-image-${index}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {image.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(image.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            ))}
            
            {/* Add More Button */}
            {uploadedImages.length < maxImages && (
              <div 
                className="aspect-square flex items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all duration-200"
                onClick={open}
                data-testid="add-more-images"
              >
                <div className="text-center">
                  <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Add More</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}