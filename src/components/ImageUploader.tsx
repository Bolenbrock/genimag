import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  selectedImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, selectedImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      onImageSelect(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {!selectedImage ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
            flex flex-col items-center justify-center gap-4 h-64
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-500/10' 
              : 'border-gray-600 hover:border-indigo-400 hover:bg-gray-800'
            }
          `}
        >
          <div className="p-4 bg-gray-800 rounded-full">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-200">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-400 mt-1">
              SVG, PNG, JPG or GIF (max. 5MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="relative group rounded-xl overflow-hidden border border-gray-700 bg-black/50 aspect-video flex items-center justify-center">
           <img 
            src={selectedImage} 
            alt="Original" 
            className="max-h-full max-w-full object-contain"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" /> Change Image
            </button>
          </div>
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white font-medium">
            Original Frame
          </div>
        </div>
      )}
    </div>
  );
};
