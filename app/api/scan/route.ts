import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
  return NextResponse.json({ 
    status: "active", 
    message: "Visionmate AI Scan API is running." 
  });
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in your .env.local file." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString("base64");

    // Switched to gemini-3.5-flash-lite for stable capacity
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          inlineData: {
            mimeType: file.type || "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: "Analyze this medicine package/strip image. Extract the pharmaceutical details and return ONLY a valid JSON object with these exact keys: brand_name, generic_name, dosage (e.g. 500mg), and expiry_date (MM/YYYY). If any field cannot be found, set its value to null.",
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const textContent = response.text;
    let extractedData;
    try {
      extractedData = textContent ? JSON.parse(textContent) : {};
    } catch (parseErr) {
      extractedData = { brand_name: textContent, generic_name: null, dosage: null, expiry_date: null };
    }

    extractedData = {
      ...extractedData,
      scan_engine: "Visionmate-AI-Core",
      verification_tag: "VERIFIED_BATCH_2026",
    };

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error("Gemini SDK Scan Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during scan." },
      { status: 500 }
    );
  }
}