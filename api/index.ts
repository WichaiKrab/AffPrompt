import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { put } from "@vercel/blob";
import multer from "multer";

const app = express();
app.use(express.json({ limit: '50mb' }));

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to get a random API key from a comma-separated list
function getRandomApiKey() {
  let keysString = process.env.GEMINI_API_KEY || "";
  // Remove any accidental quotes
  keysString = keysString.replace(/['"]/g, '');
  
  console.log("API Key check - length:", keysString.length, "starts with:", keysString.substring(0, 4));
  
  const keys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) {
    // In AI Studio, sometimes the key is injected but might not be in the comma-separated format we expect
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.replace(/['"]/g, '');
    throw new Error("GEMINI_API_KEY is not set in environment variables. Please check your Vercel settings.");
  }
  return keys[Math.floor(Math.random() * keys.length)];
}

// Vercel Blob Upload Endpoint
app.post("/api/upload", upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const blob = await put(`images/${Date.now()}-${req.file.originalname}`, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    res.json({ url: blob.url });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

app.post("/api/generate-prompts", async (req, res) => {
  try {
    const { category, customCategory, productDetail, style, setting, vibe, negativePrompt, faceImage, aspectRatio } = req.body;
    
    const hasFaceImage = !!faceImage;
    const actualCategory = category === 'อื่นๆ (ระบุเอง)' ? customCategory : category;
    
    console.log("Generating prompts for:", { actualCategory, productDetail, style, hasFaceImage });

    const promptText = `
    You are an expert prompt engineer for AI image and video generation (like Midjourney, Runway, etc.).
    I need 5 different creative poses and camera angles for a product showcase.
    
    Product Category: ${actualCategory}
    Product Detail: ${productDetail}
    Style: ${style}
    Setting/Background: ${setting}
    Vibe/Mood: ${vibe}
    Negative Prompt (Avoid these): ${negativePrompt || 'None'}
    Reference Image (Product or Character): ${hasFaceImage ? 'Yes (User provided a reference image to maintain consistency)' : 'No'}
    
    CRITICAL INSTRUCTIONS:
    - Translate the user's input to English for the 'imagePrompt' and 'videoPrompt'. AI generators work best with English.
    - Keep the 'name' and 'description' in Thai.
    - Include the requested Style in the prompts.
    - If Negative Prompt is provided, incorporate it appropriately or note it.
    - **CONSISTENCY IS KEY**: First, define a detailed physical description for the **Product** and the **Character/Model** (their appearance, clothing, specific features). Then, **REUSE THIS EXACT DESCRIPTION** in every single one of the 5 variations. Only change the pose, action, and camera angle. This is crucial so that the generated images look like the same product and person in different shots.
    
    Generate 5 unique variations. For each variation, provide:
    1. name: A short catchy name for the pose/shot (in Thai).
    2. description: A brief description of the pose and focus (in Thai).
    3. dialogue: A short, appropriate sentence or phrase the character might be saying or a speech bubble content (in Thai).
    4. imagePrompt: A detailed prompt for an AI image generator (in English). Include lighting, camera angle, style, and photorealistic details. If there is dialogue, describe it as a speech bubble or the character speaking. Do not include aspect ratio parameters here.
    5. videoPrompt: A detailed prompt for an AI video generator (in English). Describe the camera movement and subject action, including the character speaking the dialogue if appropriate.
    
    Return the result as a JSON array of objects.
    `;

    // Implement retry with exponential backoff for 503 errors
    let response;
    let retries = 0;
    const maxRetries = 5;
    
    while (retries <= maxRetries) {
      const apiKey = getRandomApiKey();
      const ai = new GoogleGenAI({ apiKey });
      
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: promptText,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  dialogue: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  videoPrompt: { type: Type.STRING }
                },
                required: ["name", "description", "dialogue", "imagePrompt", "videoPrompt"]
              }
            }
          }
        });
        break; // Success, exit loop
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        const isRetryable = errorMessage.includes('503') || 
                            errorMessage.includes('504') ||
                            errorMessage.includes('429') ||
                            errorMessage.includes('high demand') || 
                            errorMessage.includes('UNAVAILABLE') ||
                            errorMessage.includes('RESOURCE_EXHAUSTED');
                            
        if (isRetryable && retries < maxRetries) {
          retries++;
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const delay = Math.pow(2, retries) * 1000;
          console.log(`Gemini API busy or rate limited, retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
          console.log(`Error was: ${errorMessage.substring(0, 100)}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error; // Not retryable or max retries reached
      }
    }

    if (!response || !response.text) {
      throw new Error("No response text from AI");
    }

    let responseText = response.text.trim();
    // Clean markdown if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const generatedPoses = JSON.parse(responseText);
    
    const posesWithAR = generatedPoses.map((pose: any) => ({
      ...pose,
      imagePrompt: `${pose.imagePrompt} --ar ${aspectRatio}`
    }));

    res.json(posesWithAR);
  } catch (error: any) {
    console.error("Error generating prompts:", error);
    res.status(500).json({ 
      error: error.message || "Internal server error",
      details: error.stack
    });
  }
});

export default app;
