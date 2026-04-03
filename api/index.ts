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
    
    Generate 5 unique variations. For each variation, provide:
    1. name: A short catchy name for the pose/shot (in Thai).
    2. description: A brief description of the pose and focus (in Thai).
    3. imagePrompt: A detailed prompt for an AI image generator (in English). Include lighting, camera angle, style, and photorealistic details. Do not include aspect ratio parameters here.
    4. videoPrompt: A detailed prompt for an AI video generator (in English). Describe the camera movement and subject action.
    
    Return the result as a JSON array of objects.
    `;

    const apiKey = getRandomApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
              imagePrompt: { type: Type.STRING },
              videoPrompt: { type: Type.STRING }
            },
            required: ["name", "description", "imagePrompt", "videoPrompt"]
          }
        }
      }
    });

    if (!response.text) {
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

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    const ai = new GoogleGenAI({ apiKey: getRandomApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        }
      }
    });
    
    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
    
    if (imageUrl) {
      res.json({ imageUrl });
    } else {
      throw new Error("No image generated");
    }
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default app;
