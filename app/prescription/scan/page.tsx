"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createWorker } from "tesseract.js";

type MedicineRow = {
  medicine: string;
  strength: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: number | null;
};

function parsePrescriptionText(text: string): MedicineRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const isInstructionLine = (line: string) =>
    /^(?:sig|dispense(?:\s*\/\s*supply)?|supply|refill|start\s*date|date\s*issued|take|give|use|apply|drink|once|twice|thrice|morning|evening|night|daily|weekly|before|after|with|without|total|duration)\b/i.test(
      line
    );

  const isMedicineStart = (line: string) => {
    const value = line
      .replace(/^\s*r\s*x\s*[:\-]?\s*/i, "")
      .replace(/^\s*\d+\s*[.)\-:]\s*/i, "")
      .trim();

    if (!value || isInstructionLine(value)) return false;

    // Explicit Rx marker.
    if (/^\s*r\s*x\s*[:\-]?\s+/i.test(line)) return true;

    // Numbered prescription: 1. Paracetamol 500 mg
    if (/^\s*\d+\s*[.)\-:]\s*/.test(line)) {
      return hasRealMedicineName(value);
    }

    // Dosage form at the beginning: Tab Paracetamol 500 mg
    if (
      /^(?:tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|solution|inhaler|patch|powder)\b/i.test(
        value
      )
    ) {
      return hasRealMedicineName(value);
    }

    // Plain medicine line: Paracetamol 500 mg
    return hasRealMedicineName(value);
  };

  const hasRealMedicineName = (value: string) => {
    const strengthMatch = value.match(
      /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i
    );

    if (!strengthMatch) return false;

    const beforeStrength = value.slice(0, strengthMatch.index ?? 0).trim();

    // The text before the strength must contain a plausible medicine name.
    // This rejects things such as:
    // "Take 1 tablet twice daily"
    // "130 mg = 1 cap Oral Daily"
    if (!beforeStrength || !/[a-z]{3,}/i.test(beforeStrength)) return false;
    if (/^(?:sig|dispense|supply|refill|take|give|use|apply|start|date|total)\b/i.test(beforeStrength)) {
      return false;
    }

    return true;
  };

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isMedicineStart(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      // SIG, Take, Dispense, Refill and other details stay
      // inside the current medicine block.
      current.push(line);
    }
  }

  if (current.length) blocks.push(current);

  const rows: MedicineRow[] = [];

  for (const block of blocks) {
    const startLine = block[0];
    if (!startLine || !isMedicineStart(startLine)) continue;

    const medicine = startLine
      .replace(/^\s*r\s*x\s*[:\-]?\s*/i, "")
      .replace(/^\s*\d+\s*[.)\-:]\s*/i, "")
      .replace(
        /^(?:tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|solution|inhaler|patch|powder)\s+/i,
        ""
      )
      .trim();

    if (!medicine || isInstructionLine(medicine) || !hasRealMedicineName(medicine)) {
      continue;
    }

    const sigLine =
      block.find((line) => /^\s*sig\s*[:\-]?/i.test(line)) ?? "";

    // Some OCR outputs omit the "SIG:" label.
    // Keep a plain "Take ..." line as the frequency/instruction field.
    const takeLine =
      block.find((line) =>
        /^(?:take|give|use|apply|drink)\b/i.test(line)
      ) ?? "";

    const frequency = sigLine
      ? sigLine
          .replace(/^\s*sig\s*[:\-]?\s*/i, "")
          .replace(/\s+/g, " ")
          .trim()
      : takeLine.trim();

    const durationLine =
      block.find((line) =>
        /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i.test(line)
      ) ?? "";

    const duration =
      durationLine.match(
        /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i
      )?.[0] ?? "";

    const dispense = block.find((line) =>
      /^\s*(dispense|dispense\s*\/\s*supply|supply)\s*[:\-]/i.test(line)
    );

    const refill = block.find((line) =>
      /^\s*refill\s*[:\-]/i.test(line)
    );

    const instructionParts: string[] = [];

    if (dispense) {
      instructionParts.push(
        dispense
          .replace(
            /^\s*(dispense|dispense\s*\/\s*supply|supply)\s*[:\-]?\s*/i,
            ""
          )
          .trim()
      );
    }

    if (refill) {
      instructionParts.push(
        `Refill: ${refill
          .replace(/^\s*refill\s*[:\-]?\s*/i, "")
          .trim()}`
      );
    }

    rows.push({
      medicine,
      strength:
        medicine.match(
          /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i
        )?.[0] ?? "",
      frequency,
      duration,
      instructions: instructionParts.join(" | "),
      confidence: null,
    });
  }

  // Final protection against duplicate/invalid medicine rows.
  const seen = new Set<string>();

  return rows.filter((row) => {
    const name = row.medicine.trim();
    if (!name || isInstructionLine(name)) return false;

    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export default function PrescriptionScannerPage() {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [rows, setRows] = useState<MedicineRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    setError("");
    setStatus("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable in this browser.");
      }

      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError("Camera access is unavailable. You can upload an image instead.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setError("The camera is not ready yet. Please try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("We couldn't capture the image. Please try again.");
        return;
      }
      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
      setOcrText("");
      setRows([]);
      setConfidence(null);
      setSaved(false);
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function handleUpload(file?: File) {
    if (!file) return;
    setError("");
    setSaved(false);

    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPG, JPEG, PNG, or WEBP prescription image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The image is too large. Please choose an image under 10 MB.");
      return;
    }

    setImageBlob(file);
    setImageUrl(URL.createObjectURL(file));
    setOcrText("");
    setRows([]);
    setConfidence(null);
  }

  async function analyzePrescription() {
    if (!imageBlob) return;

    setBusy(true);
    setError("");
    setSaved(false);
    setStatus("Reading prescription...");

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      worker = await createWorker("eng");
      setStatus("Extracting readable text...");

      const result = await worker.recognize(imageBlob);
      const text = result.data.text.trim();
      const actualConfidence = Number(result.data.confidence);

      if (!text) {
        setOcrText("");
        setRows([]);
        setConfidence(actualConfidence);
        setError("We couldn't reliably read this prescription. Please capture a clearer image.");
        return;
      }

      setOcrText(text);
      setConfidence(Number.isFinite(actualConfidence) ? actualConfidence : null);
      setRows(parsePrescriptionText(text));
      setStatus("Review the extracted fields before saving.");

      if (actualConfidence < 55) {
        setError("Low confidence — please verify every extracted field against the original prescription.");
      }
    } catch {
      setError("We couldn't reliably read this prescription. Please try a clearer image.");
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
      if (!error) setStatus("OCR completed. Please verify the extracted information.");
    }
  }

  function updateRow(index: number, field: keyof MedicineRow, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { medicine: "", strength: "", frequency: "", duration: "", instructions: "", confidence: null },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }


  async function convertToJpeg(blob: Blob): Promise<Blob> {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not prepare prescription image."));
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare prescription image.");
      ctx.drawImage(image, 0, 0);
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!jpeg) throw new Error("Could not prepare prescription image.");
      return jpeg;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function savePrescription() {
    if (!ocrText.trim()) {
      setError("Analyze a prescription first.");
      return;
    }
    if (!imageBlob) {
      setError("The prescription image is missing. Please capture or upload it again.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Saving prescription image...");

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = "/login";
        return;
      }

      const prescriptionId = crypto.randomUUID();
      const imagePath = `${auth.user.id}/${prescriptionId}.jpg`;
      const jpegBlob = await convertToJpeg(imageBlob);

      const { error: uploadError } = await supabase.storage
        .from("prescriptions")
        .upload(imagePath, jpegBlob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("prescriptions").insert({
        id: prescriptionId,
        user_id: auth.user.id,
        image_path: imagePath,
        raw_ocr_text: ocrText,
        ocr_confidence: confidence,
        status: "needs_review",
      });

      if (insertError) {
        await supabase.storage.from("prescriptions").remove([imagePath]);
        throw insertError;
      }

      const validRows = rows.filter((row) => row.medicine.trim());

      if (validRows.length) {
        const prescriptionMedicines = validRows.map((row) => ({
          prescription_id: prescriptionId,
          user_id: auth.user.id,
          medicine_name: row.medicine.trim(),
          strength: row.strength.trim() || null,
          frequency: row.frequency.trim() || null,
          duration: row.duration.trim() || null,
          instructions: row.instructions.trim() || null,
          ocr_confidence: row.confidence,
        }));

        const { error: medicinesError } = await supabase
          .from("prescription_medicines")
          .insert(prescriptionMedicines);

        if (medicinesError) {
          await supabase.from("prescriptions").delete().eq("id", prescriptionId);
          await supabase.storage.from("prescriptions").remove([imagePath]);
          throw medicinesError;
        }

        // Medicines remain available in My medicines.
        const userMedicines = validRows.map((row) => ({
          user_id: auth.user.id,
          medicine_name: row.medicine.trim(),
          strength: row.strength.trim() || null,
          frequency: row.frequency.trim() || null,
          duration: row.duration.trim() || null,
          instructions: row.instructions.trim() || null,
          status: "active",
          source: "prescription",
          source_prescription_id: prescriptionId,
        }));

        const { error: userMedicinesError } = await supabase
          .from("user_medicines")
          .insert(userMedicines);

        if (userMedicinesError) {
          // Keep the prescription image and prescription record even if the
          // separate medication-list update fails.
          setSaved(true);
          setStatus("Prescription image saved, but the medication list could not be updated. Please try again from My medicines.");
          setError("The prescription was saved, but its medicines could not be added to My medicines.");
          return;
        }
      }

      setSaved(true);
      setStatus("Prescription image and detected medicines saved successfully.");
    } catch {
      setError("We couldn't save the prescription image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl font-semibold">Visionmate AI</Link>
          <Link href="/dashboard" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">Dashboard</Link>
        </header>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">Prescription scanner</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Scan a real prescription</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Use your camera or upload a prescription image. Visionmate runs real OCR on the image and leaves uncertain fields for you to verify.
          </p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="overflow-hidden rounded-2xl bg-[#10282B]">
              {cameraOn ? (
                <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="Prescription preview" className="aspect-[4/3] w-full object-contain bg-[#10282B]" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center px-8 text-center text-white/70">
                  <div>
                    <div className="text-5xl">▣</div>
                    <p className="mt-3 font-semibold text-white">Camera or image upload</p>
                    <p className="mt-1 text-sm">Place the whole prescription inside the frame.</p>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {!cameraOn && (
                <button onClick={startCamera} className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white">
                  Open camera
                </button>
              )}
              {cameraOn && (
                <button onClick={capturePhoto} className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white">
                  Capture
                </button>
              )}
              <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-line px-4 py-3 text-sm font-bold">
                Upload image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
            </div>

            {imageBlob && !cameraOn && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={analyzePrescription}
                  disabled={busy}
                  className="rounded-xl bg-[#17383C] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Reading prescription..." : "Analyze with OCR"}
                </button>
                <button
                  onClick={() => {
                    setImageBlob(null);
                    if (imageUrl) URL.revokeObjectURL(imageUrl);
                    setImageUrl(null);
                    setOcrText("");
                    setRows([]);
                    setConfidence(null);
                    setSaved(false);
                  }}
                  className="rounded-xl border border-line px-4 py-3 text-sm font-bold"
                >
                  Retake / choose another
                </button>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">OCR result</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">Review before saving</h2>
              </div>
              {confidence !== null && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${confidence >= 75 ? "bg-[#E7F3F1] text-signal" : "bg-amber-50 text-amber-700"}`}>
                  {Math.round(confidence)}% OCR confidence
                </span>
              )}
            </div>

            {status && <p className="mt-4 rounded-xl bg-[#F5F8F7] p-3 text-sm text-ink/65">{status}</p>}
            {error && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
            {saved && <p className="mt-4 rounded-xl bg-[#E7F3F1] p-3 text-sm font-semibold text-signal">Saved to your private prescription history.</p>}

            {!ocrText ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm leading-6 text-ink/50">
                No OCR result yet. Capture or upload a real prescription and select <strong>Analyze with OCR</strong>.
              </div>
            ) : (
              <>
                <label className="mt-6 block text-xs font-bold uppercase tracking-[.12em] text-ink/45">Raw OCR text</label>
                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  rows={8}
                  className="mt-2 w-full rounded-2xl border border-line bg-[#FBFCFC] p-4 text-sm leading-6 outline-none focus:border-signal"
                />

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">Detected medicine fields</p>
                    <p className="mt-1 text-xs text-ink/45">These are OCR-derived suggestions. Verify them manually.</p>
                  </div>
                  <button onClick={addRow} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">+ Add</button>
                </div>

                <div className="mt-3 space-y-3">
                  {rows.map((row, index) => (
                    <div key={index} className="rounded-2xl border border-line p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ["medicine", "Medicine name"],
                          ["strength", "Strength"],
                          ["frequency", "Frequency"],
                          ["duration", "Duration"],
                          ["instructions", "Instructions"],
                        ] as const).map(([field, label]) => (
                          <label key={field} className={field === "instructions" ? "sm:col-span-2" : ""}>
                            <span className="text-xs font-semibold text-ink/50">{label}</span>
                            <input
                              value={row[field]}
                              onChange={(e) => updateRow(index, field, e.target.value)}
                              className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-signal"
                            />
                          </label>
                        ))}
                      </div>
                      <button onClick={() => removeRow(index)} className="mt-3 text-xs font-bold text-red-600">Remove row</button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={savePrescription}
                  disabled={busy || saved}
                  className="mt-5 w-full rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saved ? "Saved" : busy ? "Saving..." : "Save verified prescription"}
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="mt-6 rounded-2xl border border-[#D4E6E2] bg-[#EAF5F2] p-5 text-sm leading-6 text-ink/65">
          <strong className="text-ink">Safety:</strong> OCR can misread printed or handwritten prescriptions. A low or high OCR confidence is not proof that the extracted information is correct. Verify every medicine, strength, frequency and duration against the original prescription and a qualified healthcare professional when needed. Visionmate does not prescribe or tell you to change medication.
        </aside>
      </div>
    </main>
  );
}
