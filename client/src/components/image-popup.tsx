import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Heart, X } from "lucide-react";

interface ImagePopupProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  messageId: string;
  onSaveToLibrary?: (imageUrl: string, title: string) => void;
}

export function ImagePopup({ isOpen, onClose, imageUrl, messageId, onSaveToLibrary }: ImagePopupProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `enhanced-image-${messageId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = () => {
    if (onSaveToLibrary) {
      onSaveToLibrary(imageUrl, `Enhanced Image ${new Date().toLocaleDateString()}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#1e1e1e] border-[#3a3a3a] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-[#e0e0e0] text-lg font-semibold">Enhanced Image</DialogTitle>
        </DialogHeader>
        
        <div className="relative flex flex-col items-center p-6 pt-4">
          {/* Image Display */}
          <div className="relative mb-6 max-w-full max-h-[60vh] overflow-hidden rounded-xl border border-[#3a3a3a]">
            <img 
              src={imageUrl} 
              alt="Enhanced image" 
              className="max-w-full max-h-full object-contain"
              data-testid={`popup-image-${messageId}`}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleDownload}
              data-testid={`popup-download-${messageId}`}
              className="bg-[#ffd700] hover:bg-[#ffed4e] text-black font-medium px-6 py-2 transition-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handleSave}
              data-testid={`popup-save-${messageId}`}
              className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#e0e0e0] border border-[#4a4a4a] font-medium px-6 py-2 transition-all"
            >
              <Heart className="w-4 h-4 mr-2" />
              Save to Library
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}