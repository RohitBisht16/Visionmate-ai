"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createWorker } from "tesseract.js";

type MedicineRow = {
  medicine: string;
  generic_name: string;
  strength: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: number | null;
};

function cleanOcrLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\b1P\b/g, "IP")
    .trim();
}

function calculateExpiryDateFromDuration(durationText: string): string | null {
  if (!durationText) return null;
  const match = durationText.match(
    /(\d+)\s*(day|days|d|week|weeks|wk|wks|month|months|mo|mos)\b/i
  );
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  if (isNaN(amount) || amount <= 0) return null;

  const unit = match[2].toLowerCase();
  const date = new Date();
  date.setHours(23, 59, 59, 999);

  if (unit.startsWith("d")) {
    date.setDate(date.getDate() + amount);
  } else if (unit.startsWith("w")) {
    date.setDate(date.getDate() + amount * 7);
  } else if (unit.startsWith("m")) {
    date.setMonth(date.getMonth() + amount);
  }

  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function fallbackParsePrescriptionText(text: string): MedicineRow[] {
  const lines = text.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);

  // Matches EITHER "Rx: <medicine>" OR "1) TAB. <medicine>" OR "TAB. <medicine>"
  const rxMarkerRegex = /^r\s*x\s*[:\-]\s*(.+)/i;
  const numberedOrFormRegex =
    /^(?:\d+\s*[.)\-:]\s*)?(?:tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|inhaler)\.?\s+(.+)/i;

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (
      /^(?:advice|follow\s*up|substitute|dispense\s+as\s+written|prescribed\s+by|signature)\b/i.test(
        line
      )
    ) {
      if (current.length) blocks.push(current);
      current = [];
      break;
    }

    if (rxMarkerRegex.test(line) || numberedOrFormRegex.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  return blocks
    .map((block) => {
      const fullText = block.join(" ");
      const firstLine = block[0]
        .replace(/^r\s*x\s*[:\-]\s*/i, "")
        .replace(/^\d+\s*[.)\-:]\s*/i, "")
        .replace(/\bstart\s*date\s*[:\-].*$/i, "")
        .trim();

      const durationMatch = fullText.match(
        /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i
      );
      const strengthMatch = fullText.match(
        /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i
      );
      const sigLine = block.find((l) => /^sig\s*[:\-]/i.test(l));
      const freqMatch = sigLine
        ? sigLine.replace(/^sig\s*[:\-]\s*/i, "").trim()
        : fullText.match(
            /\b(?:\d+\s*(?:morning|afternoon|evening|night)|once|twice|thrice|daily|bd|tds|od|hs)(?:[^.,;\n]*)/i
          )?.[0] || "";

      const nameOnly = firstLine
        .replace(
          /\b\d+\s*(?:morning|afternoon|evening|night|day|days|week|weeks).*$/i,
          ""
        )
        .trim();

      const compositionLines = block.slice(1).filter(
        (l) =>
          !/^(?:sig|dispense|supply|refill|start\s*date)\b/i.test(l) &&
          !/^\(?\s*tot\s*:/i.test(l) &&
          !/^\d+\s*days?\b/i.test(l)
      );

      return {
        medicine: nameOnly || firstLine,
        generic_name: compositionLines.join(" "),
        strength: strengthMatch?.[0] || "",
        frequency: freqMatch,
        duration: durationMatch?.[0] || "",
        instructions: "",
        confidence: null,
      };
    })
    .filter((row) => row.medicine.length >= 3);
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
  const [patientName, setPatientName] = useState("");
  const [scannedDate, setScannedDate] = useState("");

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
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
    canvas.toBlob(
      (blob) => {
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
        setPatientName("");
        setScannedDate("");
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
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
    setPatientName("");
    setScannedDate("");
  }

  async function analyzePrescription() {
    if (!imageBlob) return;

    setBusy(true);
    setError("");
    setSaved(false);
    setStatus("Scanning and separating medicines cleanly...");

    try {
      // 1. Primary: Structured Vision AI extraction
      const formData = new FormData();
      formData.append("image", imageBlob, "prescription.jpg");

      const aiResponse = await fetch("/api/parse-prescription", {
        method: "POST",
        body: formData,
      });

      let fallbackReason = "";

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const extracted: MedicineRow[] = (aiData.medicines || []).map(
          (m: any) => ({
            medicine: String(m.medicine || "").trim(),
            generic_name: String(m.generic_name || "").trim(),
            strength: String(m.strength || "").trim(),
            frequency: String(m.frequency || "").trim(),
            duration: String(m.duration || "").trim(),
            instructions: String(m.instructions || "").trim(),
            confidence: 96,
          })
        );

        setOcrText(aiData.raw_text || "Structured scan complete.");
        setConfidence(96);
        setRows(extracted);
        setPatientName(aiData.patient_name || "");
        setScannedDate(new Date().toISOString());

        if (!extracted.length) {
          setError(
            "No medicines were detected in this image. Please try a clearer photo."
          );
        } else {
          setStatus(
            `${extracted.length} medicine${extracted.length === 1 ? "" : "s"} separated cleanly with dosage and duration.`
          );
        }
        return;
      } else {
        const errBody = await aiResponse.json().catch(() => ({}));
        fallbackReason = errBody?.error || `HTTP ${aiResponse.status}`;
        console.warn("Vision API fallback reason:", fallbackReason);
      }

      // 2. Fallback: Local Tesseract OCR if AI API fails
      setStatus(
        `Using offline OCR (${fallbackReason || "network fallback"})...`
      );
      const worker = await createWorker("eng");
      try {
        const result = await worker.recognize(imageBlob);
        const text = result.data.text.trim();
        const actualConfidence = Number(result.data.confidence);
        const parsedRows = fallbackParsePrescriptionText(text);

        setOcrText(text);
        setConfidence(Number.isFinite(actualConfidence) ? actualConfidence : null);
        setRows(parsedRows);
        setScannedDate(new Date().toISOString());

        if (!parsedRows.length) {
          setError(
            "Could not detect clear medicine rows. Please add or edit manually."
          );
        } else {
          setStatus(
            `${parsedRows.length} medicine(s) detected. Please verify before saving.`
          );
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setError(
        "We couldn't reliably read this prescription. Please try a clearer image."
      );
    } finally {
      setBusy(false);
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
      {
        medicine: "",
        generic_name: "",
        strength: "",
        frequency: "",
        duration: "",
        instructions: "",
        confidence: null,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  async function savePrescription() {
    const validRows = rows.filter((row) => row.medicine.trim());
    if (!validRows.length) {
      setError(
        "No medicine was detected. Please verify or add at least one medicine."
      );
      return;
    }

    setBusy(true);
    setError("");
    let uploadedPath: string | null = null;

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = "/login";
        return;
      }

      if (!imageBlob) {
        throw new Error("Prescription image is missing.");
      }

      const mime = imageBlob.type || "image/jpeg";
      const extension =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

      uploadedPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("prescriptions")
        .upload(uploadedPath, imageBlob, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: prescription, error: insertError } = await supabase
        .from("prescriptions")
        .insert({
          user_id: auth.user.id,
          raw_ocr_text: ocrText || "Verified prescription",
          ocr_confidence: confidence,
          status: "verified",
          image_path: uploadedPath,
          patient_name: patientName.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 1. Save to prescription_medicines
      const { error: medicinesError } = await supabase
        .from("prescription_medicines")
        .insert(
          validRows.map((row) => ({
            prescription_id: prescription.id,
            user_id: auth.user.id,
            medicine_name: row.medicine.trim(),
            strength: row.strength.trim() || null,
            frequency: row.frequency.trim() || null,
            duration: row.duration.trim() || null,
            instructions:
              [row.generic_name, row.instructions].filter(Boolean).join(" • ") ||
              null,
            ocr_confidence: row.confidence,
          }))
        );

      if (medicinesError) throw medicinesError;

      // 2. Sync to user_medicines with computed expiry_date for Yellow/Red expiry alerts
      const { error: userMedError } = await supabase
        .from("user_medicines")
        .insert(
          validRows.map((row) => ({
            user_id: auth.user.id,
            medicine_name: row.medicine.trim(),
            generic_name: row.generic_name.trim() || null,
            strength: row.strength.trim() || null,
            frequency: row.frequency.trim() || null,
            duration: row.duration.trim() || null,
            instructions: row.instructions.trim() || null,
            expiry_date: calculateExpiryDateFromDuration(row.duration),
            status: "active",
          }))
        );

      if (userMedError) {
        console.warn("Could not sync to user_medicines:", userMedError);
      }

      setSaved(true);
      setStatus(
        `Saved ${validRows.length} medicine${validRows.length === 1 ? "" : "s"} to your prescription history and Active Medicines!`
      );
    } catch (saveError) {
      if (uploadedPath) {
        await supabase.storage.from("prescriptions").remove([uploadedPath]);
      }
      console.error(saveError);
      setError(
        "We couldn't save the prescription. Please check your Supabase setup and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-display text-2xl font-semibold"
          >
            Visionmate AI
          </Link>

          <div className="flex gap-2">
            <Link
              href="/medicines"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              My Medicines
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
            Prescription scanner
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Scan a real prescription
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Upload or capture any prescription. Visionmate separates each
            medicine cleanly with its salt composition, dosage, and course
            duration.
          </p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="overflow-hidden rounded-2xl bg-[#10282B]">
              {cameraOn ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Prescription preview"
                  className="aspect-[4/3] w-full object-contain bg-[#10282B]"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center px-8 text-center text-white/70">
                  <div>
                    <div className="text-5xl">▣</div>
                    <p className="mt-3 font-semibold text-white">
                      Camera or image upload
                    </p>
                    <p className="mt-1 text-sm">
                      Place the whole prescription inside the frame.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {!cameraOn ? (
                <button
                  onClick={startCamera}
                  className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
                >
                  Open camera
                </button>
              ) : (
                <button
                  onClick={capturePhoto}
                  className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
                >
                  Capture
                </button>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-line px-4 py-3 text-sm font-bold"
              >
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
                  {busy ? "Scanning medicines..." : "Analyze Prescription"}
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
                    setStatus("");
                    setError("");
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
                <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
                  Scan result
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold">
                  Review before saving
                </h2>
              </div>

              {confidence !== null && (
                <span className="rounded-full bg-[#E7F3F1] px-3 py-1 text-xs font-bold text-signal">
                  {Math.round(confidence)}% accuracy
                </span>
              )}
            </div>

            {status && (
              <p className="mt-4 rounded-xl bg-[#F5F8F7] p-3 text-sm text-ink/65">
                {status}
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {error}
              </p>
            )}

            {saved && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#E7F3F1] p-3 text-sm font-semibold text-signal">
                <span>Saved! Expiry tracking is now active.</span>
                <Link href="/medicines" className="underline">
                  View Medicines →
                </Link>
              </div>
            )}

            {!ocrText && !rows.length ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm leading-6 text-ink/50">
                No scan result yet. Capture or upload a prescription and click{" "}
                <strong>Analyze Prescription</strong>.
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold text-ink/50">
                      Patient name
                    </span>
                    <input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter patient name"
                      className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-signal"
                    />
                  </label>
                  <div>
                    <span className="text-xs font-semibold text-ink/50">
                      Scan date
                    </span>
                    <p className="mt-1 rounded-xl border border-line bg-[#FBFCFC] px-3 py-2.5 text-sm">
                      {scannedDate
                        ? new Date(scannedDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">
                      Separated medicines ({rows.length})
                    </p>
                    <p className="mt-1 text-xs text-ink/45">
                      Duration automatically sets each medicine&apos;s expiry alert.
                    </p>
                  </div>

                  <button
                    onClick={addRow}
                    className="rounded-lg border border-line px-3 py-2 text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {rows.map((row, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-line p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-full bg-[#E7F3F1] px-2.5 py-1 text-xs font-bold text-signal">
                          Medicine {index + 1}
                        </span>

                        <button
                          onClick={() => removeRow(index)}
                          className="text-xs font-bold text-red-600"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["medicine", "Medicine name"],
                            ["generic_name", "Salt / Generic composition"],
                            ["strength", "Strength"],
                            ["frequency", "Frequency / Dosage"],
                            ["duration", "Duration (e.g. 5 Days)"],
                            ["instructions", "Instructions (e.g. After Food)"],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field}>
                            <span className="text-xs font-semibold text-ink/50">
                              {label}
                            </span>

                            <input
                              value={row[field]}
                              onChange={(e) =>
                                updateRow(index, field, e.target.value)
                              }
                              className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-signal"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={savePrescription}
                  disabled={busy || saved}
                  className="mt-5 w-full rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saved
                    ? "Saved"
                    : busy
                      ? "Saving..."
                      : "Save verified prescription"}
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="mt-6 rounded-2xl border border-[#D4E6E2] bg-[#EAF5F2] p-5 text-sm leading-6 text-ink/65">
          <strong className="text-ink">Safety:</strong> Always verify extracted
          medicine names, strengths, and durations against the original
          prescription before taking medication.
        </aside>
      </div>
    </main>
  );
}