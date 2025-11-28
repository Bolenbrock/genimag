
import { GoogleGenAI } from "@google/genai";

/**
 * Generates a motion frame based on an original image.
 * Uses gemini-2.5-flash-image for fast image-to-image generation.
 */
export const generateMotionFrame = async (
  base64Image: string,
  frameIndex: number,
  totalFrames: number,
  description: string,
  direction: string
): Promise<string> => {
  try {
    // Initialize AI client inside the function to ensure it uses the latest process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Strip the data:image prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const model = 'gemini-2.5-flash-image';
    
    // Construct a prompt that guides the model to create a sequential movement
    const progress = Math.round((frameIndex / totalFrames) * 100);
    
    const prompt = `
      Input image provided. 
      Task: Generate a modified version of this image representing a specific moment in a motion sequence.
      Context: This is frame ${frameIndex} of a ${totalFrames}-frame sequence.
      Action: ${description}.
      Direction of Movement: ${direction}.
      
      Instruction: 
      - The main subject must appear to have moved in the direction: "${direction}".
      - "Zoom In" means the subject gets closer/larger. "Zoom Out" means it gets farther/smaller.
      - "Left", "Right", "Up", "Down" means the subject shifts position in the frame.
      - This represents ${progress}% completion of the movement.
      - Maintain the exact background, lighting, and art style of the original.
      - Do not change the camera angle significantly unless the direction implies it (e.g., Zoom).
      - Maintain consistency with the original image content.
      - CRITICAL: Ensure there is strictly ONE instance of the main subject. Do NOT create duplicates, clones, or ghost images of the subject. Do NOT add other similar objects to the scene. The scene must contain only the original subject moved to the new position.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: cleanBase64,
            },
          },
        ],
      },
      config: {
        // We use a moderate temperature to balance creativity with consistency
        temperature: 0.4, 
      }
    });

    // Extract the image from the response
    let generatedImageUrl = "";
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!generatedImageUrl) {
      throw new Error("No image data returned from Gemini.");
    }

    return generatedImageUrl;

  } catch (error) {
    console.error(`Error generating frame ${frameIndex}:`, error);
    throw error;
  }
};

/**
 * Upscales a frame using Gemini 3 Pro Image Preview.
 * Requires a paid API key which is handled by the caller ensuring key selection.
 */
export const upscaleFrame = async (
  base64Image: string,
  aspectRatio: string = "1:1"
): Promise<string> => {
  try {
    // IMPORTANT: Create a new instance to ensure we pick up the selected API key if it changed
    // This is required when switching to Pro models that might require a specific key scope
    const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    const model = 'gemini-3-pro-image-preview';

    const prompt = `
      High-Quality Upscale Task.
      Enhance the resolution, details, clarity, and texture of this image to 2K quality.
      Strictly maintain the original composition, subject pose, lighting, and style.
      Do not change the content or add new objects. This is a direct upscale.
    `;

    const response = await freshAi.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize: '2K',
          aspectRatio: aspectRatio as any, // Cast to match API literal type requirement if needed
        },
      }
    });

    let upscaledImageUrl = "";
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          upscaledImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!upscaledImageUrl) {
      throw new Error("No upscaled image returned from Gemini.");
    }

    return upscaledImageUrl;

  } catch (error) {
    console.error("Error upscaling frame:", error);
    throw error;
  }
};
