
export interface GeneratedFrame {
  id: number;
  imageUrl: string;
  promptUsed: string;
}

export interface GenerationStatus {
  isGenerating: boolean;
  completedFrames: number;
  totalFrames: number;
  error?: string;
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
