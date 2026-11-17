import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing in .env.local" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const prompt = `Transcribe and extract ALL prescribed medicines and patient details from this prescription image into JSON.
Rules:
- Extract EVERY single medicine listed (do not skip the first rows).
- Keep each medicine as ONE single object (never split salt composition or SIG/Dispense lines into separate items).
- Put brand/main name in "medicine", generic salts in "generic_name", dosage strength in "strength", SIG/schedule in "frequency", duration (e.g. "5 Days" or compute from Dispense/SIG if clear) in "duration", and Dispense/Refill/notes in "instructions".
- Extract "patient_name" from the top header if visible (otherwise "").
- Return ONLY valid JSON:
{
  "patient_name": "",
  "raw_text": "",
  "medicines": [
    {
      "medicine": "",
      "generic_name": "",
      "strength": "",
      "frequency": "",
      "duration": "",
      "instructions": ""
    }
  ]
}`;

   const models = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.0-flash"];
    let lastErr = "";

    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            safetySettings: [
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!res.ok) {
        lastErr = await res.text();
        console.error(`Model ${model} failed:`, lastErr);
        continue;
      }

      const data = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");

      if (firstBrace === -1 || lastBrace === -1) {
        lastErr = `Model ${model} returned non-JSON: ${rawText.slice(0, 200)}`;
        console.error(lastErr);
        continue;
      }

      const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonSlice);

      return NextResponse.json({
        patient_name: parsed.patient_name || "",
        raw_text: parsed.raw_text || "Scanned via Vision AI",
        medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
      });
    }

    return NextResponse.json(
      { error: `Vision API failed: ${lastErr}` },
      { status: 502 }
    );
  } catch (err: any) {
    console.error("Prescription parse error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to parse prescription" },
      { status: 500 }
    );
  }
}