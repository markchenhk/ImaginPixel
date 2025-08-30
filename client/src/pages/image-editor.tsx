import Sidebar from '@/components/sidebar';
import ImageGenerator from '@/components/image-generator';

export default function ImageEditor() {
  return (
    <div className="h-screen flex bg-gray-950 text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <ImageGenerator />
    </div>
  );
}
