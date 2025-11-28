
import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { AnimationPlayer } from './components/AnimationPlayer';
import { generateMotionFrame, upscaleFrame } from './services/geminiService';
import { Wand2, Film, AlertCircle, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ZoomIn, ZoomOut, Move, Download, FileArchive, Video, Sparkles } from 'lucide-react';
import { GenerationStatus } from './types';
import JSZip from 'jszip';

const TOTAL_FRAMES = 10;

const DIRECTION_OPTIONS = [
  { id: 'Left', label: 'Left', icon: ArrowLeft },
  { id: 'Right', label: 'Right', icon: ArrowRight },
  { id: 'Up', label: 'Up', icon: ArrowUp },
  { id: 'Down', label: 'Down', icon: ArrowDown },
  { id: 'Zoom In', label: 'Closer', icon: ZoomIn },
  { id: 'Zoom Out', label: 'Farther', icon: ZoomOut },
];

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [promptDescription, setPromptDescription] = useState<string>('The main subject is moving');
  const [selectedDirection, setSelectedDirection] = useState<string>('Right');
  const [status, setStatus] = useState<GenerationStatus>({
    isGenerating: false,
    completedFrames: 0,
    totalFrames: TOTAL_FRAMES
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);

  const handleImageSelect = (base64: string) => {
    setOriginalImage(base64);
    // Reset previous generation when new image is uploaded
    setGeneratedFrames([]);
    setStatus({ isGenerating: false, completedFrames: 0, totalFrames: TOTAL_FRAMES });
  };

  const handleGenerate = async () => {
    if (!originalImage) return;

    setStatus({ isGenerating: true, completedFrames: 0, totalFrames: TOTAL_FRAMES });
    setGeneratedFrames([]);
    
    // We include the original as the first frame for context in the UI, 
    // but we will generate TOTAL_FRAMES NEW frames to create the movement.
    
    try {
      const promises = [];
      
      // Parallel generation for speed. 
      for (let i = 1; i <= TOTAL_FRAMES; i++) {
        // Stagger requests slightly to avoid hitting rate limits instantly if needed, 
        // though Promise.all fires them concurrently.
        const delay = i * 100; 
        
        promises.push(
          new Promise(resolve => setTimeout(resolve, delay)).then(() => 
            generateMotionFrame(originalImage, i, TOTAL_FRAMES, promptDescription, selectedDirection)
              .then(frame => {
                setStatus(prev => ({ ...prev, completedFrames: prev.completedFrames + 1 }));
                return { index: i, frame };
              })
          )
        );
      }

      const results = await Promise.all(promises);
      
      // Sort by index to maintain sequence order
      const sortedFrames = results
        .sort((a: any, b: any) => a.index - b.index)
        .map((item: any) => item.frame);

      // Combine original + generated
      setGeneratedFrames([originalImage, ...sortedFrames]);
      setStatus(prev => ({ ...prev, isGenerating: false }));

    } catch (error) {
      console.error("Generation failed", error);
      setStatus(prev => ({ 
        ...prev, 
        isGenerating: false, 
        error: "Failed to generate frames. Please try again or use a different image." 
      }));
    }
  };

  // Helper to load image for canvas
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const getClosestAspectRatio = async (imgSrc: string): Promise<string> => {
    const img = await loadImage(imgSrc);
    const ratio = img.width / img.height;
    
    // Supported: 1:1 (1.0), 3:4 (0.75), 4:3 (1.33), 9:16 (0.5625), 16:9 (1.77)
    const supportedRatios = [
      { id: "1:1", val: 1.0 },
      { id: "3:4", val: 0.75 },
      { id: "4:3", val: 1.333 },
      { id: "9:16", val: 0.5625 },
      { id: "16:9", val: 1.778 }
    ];

    const closest = supportedRatios.reduce((prev, curr) => {
      return (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev);
    });

    return closest.id;
  };

  const handleUpscale = async () => {
    if (generatedFrames.length === 0) return;

    // Check for API key for Pro model
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey && window.aistudio.openSelectKey) {
        try {
          await window.aistudio.openSelectKey();
          // Assume success as per instructions and proceed
        } catch (e) {
          console.error("Failed to select key", e);
          return;
        }
      }
    }

    setIsUpscaling(true);
    setStatus(prev => ({ ...prev, completedFrames: 0, totalFrames: generatedFrames.length }));

    try {
      // Determine aspect ratio from first frame to ensure consistency
      const aspectRatio = await getClosestAspectRatio(generatedFrames[0]);
      console.log(`Upscaling with aspect ratio: ${aspectRatio}`);

      const upscaledPromises = generatedFrames.map(async (frame, index) => {
        // Stagger slightly
        await new Promise(r => setTimeout(r, index * 200));
        const upscaled = await upscaleFrame(frame, aspectRatio);
        setStatus(prev => ({ ...prev, completedFrames: prev.completedFrames + 1 }));
        return { index, frame: upscaled };
      });

      const results = await Promise.all(upscaledPromises);
      const sortedUpscaled = results
        .sort((a, b) => a.index - b.index)
        .map(item => item.frame);

      setGeneratedFrames(sortedUpscaled);

    } catch (error) {
      console.error("Upscale failed", error);
      alert("Upscale failed. Please check your API key quotas or try again.");
    } finally {
      setIsUpscaling(false);
      setStatus(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleDownloadVideo = async () => {
    if (generatedFrames.length === 0) return;
    setIsDownloading(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // Load first image to set dimensions
      const firstFrame = await loadImage(generatedFrames[0]);
      canvas.width = firstFrame.width;
      canvas.height = firstFrame.height;

      // Determine supported MIME type
      let mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4'; // Try mp4 (Safari)
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          alert("Video recording not supported on this browser. Please try downloading frames as ZIP.");
          setIsDownloading(false);
          return;
        }
      }

      const stream = canvas.captureStream(30); // Capture at 30fps stream capability
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `motion-gen-${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsDownloading(false);
      };

      recorder.start();

      // Draw frames with delay
      // 4 FPS = 250ms per frame
      for (const frameBase64 of generatedFrames) {
        const img = await loadImage(frameBase64);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        await new Promise(r => setTimeout(r, 250)); 
      }
      
      // Stop recording
      recorder.stop();

    } catch (error) {
      console.error("Video creation failed", error);
      setIsDownloading(false);
      alert("Failed to create video.");
    }
  };

  const handleDownloadZip = async () => {
    if (generatedFrames.length === 0) return;
    setIsDownloading(true);

    try {
      const zip = new JSZip();
      
      generatedFrames.forEach((frame, index) => {
        // Remove data URL prefix
        const data = frame.replace(/^data:image\/\w+;base64,/, "");
        const filename = `frame_${String(index + 1).padStart(3, '0')}.png`;
        zip.file(filename, data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `motion-gen-frames-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("ZIP creation failed", error);
      alert("Failed to create ZIP archive.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500/30">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              MotionGen AI
            </h1>
          </div>
          <div className="text-sm text-slate-400 hidden sm:block">
            Powered by Gemini 2.5 Flash
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        
        {/* Intro Section */}
        <section className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Bring your photos to life
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Upload a static image, choose a direction, and watch AI generate a 10-frame motion sequence.
          </p>
        </section>

        {/* Editor Section */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Input (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">1</span>
                Upload Image
              </h3>
              <ImageUploader 
                onImageSelect={handleImageSelect} 
                selectedImage={originalImage} 
              />
            </div>

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">2</span>
                Motion Settings
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Subject & Action
                  </label>
                  <textarea
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    placeholder="e.g., A bird flying"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500 resize-none h-20"
                    disabled={status.isGenerating || isUpscaling}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <Move className="w-4 h-4" /> Movement Direction
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIRECTION_OPTIONS.map((dir) => {
                      const Icon = dir.icon;
                      const isSelected = selectedDirection === dir.id;
                      return (
                        <button
                          key={dir.id}
                          onClick={() => setSelectedDirection(dir.id)}
                          disabled={status.isGenerating || isUpscaling}
                          className={`
                            flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                            ${isSelected 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
                            }
                          `}
                        >
                          <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                          <span className="text-xs font-medium">{dir.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button 
                  onClick={handleGenerate}
                  disabled={!originalImage || status.isGenerating || isUpscaling}
                  isLoading={status.isGenerating && !isUpscaling}
                  className="w-full py-3 text-lg mt-4"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  {status.isGenerating && !isUpscaling
                    ? `Generating ${status.completedFrames}/${status.totalFrames}...` 
                    : 'Generate Animation'
                  }
                </Button>

                {status.error && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {status.error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Preview (Span 7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl min-h-[500px] flex flex-col">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">3</span>
                Result Preview
              </h3>
              
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                {generatedFrames.length > 0 ? (
                  <div className="w-full animate-in fade-in duration-700 flex flex-col items-center">
                     <AnimationPlayer frames={generatedFrames} fps={4} />
                     
                     <div className="mt-8 flex flex-wrap gap-4 justify-center w-full px-4">
                        <Button 
                          onClick={handleUpscale}
                          disabled={isDownloading || isUpscaling || status.isGenerating}
                          variant="primary"
                          className="flex items-center gap-2 w-full sm:w-auto bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isUpscaling 
                            ? `Upscaling ${status.completedFrames}/${generatedFrames.length}...`
                            : 'Real Upscale (2K)'
                          }
                        </Button>

                        <div className="w-full sm:w-px h-px sm:h-10 bg-slate-700 mx-2 hidden sm:block"></div>

                        <Button 
                          onClick={handleDownloadVideo}
                          disabled={isDownloading || isUpscaling || status.isGenerating}
                          variant="secondary"
                          className="flex items-center gap-2 w-full sm:w-auto"
                        >
                          <Video className="w-4 h-4" />
                          Download Video
                        </Button>
                        <Button 
                          onClick={handleDownloadZip}
                          disabled={isDownloading || isUpscaling || status.isGenerating}
                          variant="secondary"
                          className="flex items-center gap-2 w-full sm:w-auto"
                        >
                          <FileArchive className="w-4 h-4" />
                          Download ZIP
                        </Button>
                     </div>
                     <p className="text-xs text-slate-500 mt-4 text-center max-w-md">
                       Note: Upscaling uses the Gemini 3 Pro model and requires a paid API key. 
                       It will significantly enhance the resolution of all frames.
                     </p>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-12 flex flex-col items-center justify-center h-full">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 animate-pulse">
                      <Film className="w-10 h-10 opacity-30" />
                    </div>
                    <p className="text-lg font-medium">No animation generated yet</p>
                    <p className="text-sm opacity-60 max-w-xs mt-2">Upload an image and click generate to see the magic happen.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
