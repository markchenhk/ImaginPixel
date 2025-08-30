import { useQuery } from '@tanstack/react-query';
import ImageComparison from './image-comparison';
import type { ImageProcessingJob } from '@shared/schema';

interface ImagePreviewProps {
  originalImageUrl: string | null;
  processedImageUrl: string | null;
  processingJobId?: string;
}

export default function ImagePreview({ 
  originalImageUrl, 
  processedImageUrl, 
  processingJobId 
}: ImagePreviewProps) {
  // Poll for processing job updates
  const { data: processingJob } = useQuery<ImageProcessingJob>({
    queryKey: ['/api/processing-jobs', processingJobId],
    enabled: !!processingJobId,
    refetchInterval: processingJobId ? 2000 : false, // Poll every 2 seconds if there's a job
  });

  const currentProcessedUrl = processingJob?.processedImageUrl || processedImageUrl;

  return (
    <div className="flex-1 flex flex-col">
      <ImageComparison 
        originalImageUrl={originalImageUrl || ''}
        processedImageUrl={currentProcessedUrl || undefined}
      />
      
      {/* Processing Details */}
      {(processingJob || originalImageUrl) && (
        <div className="border-t border-border p-6">
          <div className="bg-card rounded-lg p-4">
            <h3 className="font-medium mb-3">Processing Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Model:</span>
                <span className="ml-2" data-testid="processing-model">
                  {processingJob?.model || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Processing Time:</span>
                <span className="ml-2" data-testid="processing-time">
                  {processingJob?.processingTime ? `${processingJob.processingTime}s` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2" data-testid="processing-status">
                  {processingJob?.status || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Output Format:</span>
                <span className="ml-2" data-testid="output-format">JPG</span>
              </div>
            </div>
            
            {/* Enhancements Applied */}
            {processingJob?.enhancementsApplied && processingJob.enhancementsApplied.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Enhancements Applied:
                </h4>
                <ul className="text-sm space-y-1">
                  {processingJob.enhancementsApplied.map((enhancement, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      <span>{enhancement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Message */}
            {processingJob?.status === 'error' && processingJob.errorMessage && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive" data-testid="error-message">
                  {processingJob.errorMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
