import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({ 
    status: "active", 
    message: "Visionmate AI Scan API is running." 
  });
}

async function callGeminiWithRetry(apiKey: string, base64Image: string, mimeType: string, maxRetries = 3) {
  const models = ["gemini-3.8-flash", "gemini-1.5-flash"];
  
  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "Analyze this medicine package/strip image. Extract the pharmaceutical details and return ONLY a valid JSON object with these exact keys: brand_name, generic_name, dosage (e.g. 500mg), and expiry_date (MM/YYYY). If any field cannot be found, set its value to null.",
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        return result;
      }

      // If it's a 503 high demand error, wait 1 second and retry
      if (response.status === 503 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }

      // If model not found, try the next model option
      if (response.status === 404 || result.error?.message?.includes("not found")) {
        break;
      }

      throw new Error(result.error?.message || `API error status ${response.status}`);
    }
  }
  throw new Error("All Gemini models are currently experiencing high demand. Please try again shortly.");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString("base64");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in your .env.local file." },
        { status: 500 }
      );
    }

    const result = await callGeminiWithRetry(apiKey, base64Image, file.type || "image/jpeg");

    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    let extractedData;
    try {
      extractedData = textContent ? JSON.parse(textContent) : {};
    } catch (parseErr) {
      extractedData = { brand_name: textContent, generic_name: null, dosage: null, expiry_date: null };
    }

    // Attach unique verification metadata signature for project individuality
    extractedData = {
      ...extractedData,
      scan_engine: "Visionmate-AI-Core",
      verification_tag: "VERIFIED_BATCH_2026",
    };

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error during scan." },
      { status: 500 }
    );
  }
}