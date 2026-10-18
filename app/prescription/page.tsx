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

/*
  IMPORTANT:
  A prescription medicine is a BLOCK, not a single OCR line.

  Example:
    Rx: morphine 130 mg/24 hours oral capsule
    SIG: 130 mg = 1 cap Oral Daily
    Dispense/Supply: **30** cap
    Refill: **0**

  These four lines are ONE medicine.

  We therefore split only when a new Rx/Prescription marker appears.
  SIG, Dispense/Supply, Refill and Start Date are medicine information
  and must never become separate medicine rows.
*/

function cleanOcrLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}


function extractPatientNameFromOcr(text: string) {
  const lines = text.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);

  const explicit = lines.find((line) =>
    /^(?:patient\s*name|patient)\s*[:\-]/i.test(line)
  );

  if (explicit) {
    return explicit
      .replace(/^(?:patient\s*name|patient)\s*[:\-]\s*/i, "")
      .replace(/\s{2,}.*/g, "")
      .trim();
  }

  // Common OCR format: "Patient Name: Rajesh Kumar Age: 45 Years..."
  const inline = text.match(
    /patient\s*name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,})(?=\s+(?:age|sex|gender|mrn|date)\b|$)/i
  );

  return inline?.[1]?.trim() || "Patient name not detected";
}

const MEDICINE_FORMS =
  "(?:tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|solution|inhaler|patch|powder)";

const NON_MEDICINE_START =
  /^(?:sig|dispense(?:\s*\/\s*supply)?|supply|refill|start\s*date|date\s*issued|patient|birthdate|age|sex|mrn|allerg(?:y|ies)|patient\s*address|home\s*phone|work\s*phone|prescribed\s*by|entered\s*by|dea|npi|advice|doctor|clinic|date)\b/i;

function stripOcrJunk(value: string) {
  return value
    .replace(/^\s*[|Il]\s*/i, "")
    .replace(/^\s*[({\[]+/, "")
    .replace(/[)}\]]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeNumberMarker(value: string) {
  return value.replace(/^\s*\d+\s*[.)\-:]\s*/i, "").trim();
}

function hasMedicineStrength(value: string) {
  return /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i.test(value);
}

function hasDosageFormAtStart(value: string) {
  // Accept OCR variants such as "TAB. VOMILAST" as a medicine start.
  return new RegExp(
    `^${MEDICINE_FORMS}(?:\\.|\\s|:)`,
    "i",
  ).test(value.trim());
}

function looksLikeMedicineName(text: string) {
  let value = stripOcrJunk(text);
  value = removeNumberMarker(value);
  value = value
    .replace(/^r\s*x\s*[:\-]?\s*/i, "")
    .replace(new RegExp(`^${MEDICINE_FORMS}(?:\\.|\\s|:)`, "i"), "")
    .trim();

  if (!value || value.length < 3) return false;
  if (/^[({\[]/.test(value)) return false;
  if (NON_MEDICINE_START.test(value)) return false;

  // Never treat prescription instructions/metadata as a medicine.
  if (/^(?:after|before|with|without|take|give|use|apply|drink|once|twice|morning|evening|night|daily|weekly|total|tot|dispense|supply|refill|sig)\b/i.test(value)) {
    return false;
  }

  // A medicine start must contain either a real strength or a dosage form
  // at the START of the line. A "Tab" appearing later in a sentence is not enough.
  const original = stripOcrJunk(text);
  const startsWithForm = hasDosageFormAtStart(removeNumberMarker(original));
  const hasStrength = hasMedicineStrength(value);

  if (!hasStrength && !startsWithForm) return false;

  // Reject pure instructions such as "130 mg = 1 cap Oral Daily".
  if (/^\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%)\b\s*=/.test(value)) return false;

  return /[a-z]{3,}/i.test(value);
}

function isPrescriptionStart(line: string) {
  const raw = cleanOcrLine(line);

  if (!raw || NON_MEDICINE_START.test(raw)) return false;

  // Never allow instruction/metadata lines to start a new medicine.
  if (
    /^(?:sig|dispense|dispense\s*\/\s*supply|supply|refill|start\s*date|date\s*issued|take|give|use|apply|drink|once|twice|morning|evening|night|daily|weekly|total|tot|after|before|with|without)\b/i.test(
      raw
    )
  ) {
    return false;
  }

  // Parenthetical lines are instructions, not medicine starts.
  if (/^[({\[]/.test(raw)) return false;

  // Explicit Rx marker is the strongest signal.
  if (/^r\s*x\s*[:\-]?\s+/i.test(raw)) {
    return looksLikeMedicineName(raw);
  }

  const withoutNumber = removeNumberMarker(raw);
  const isNumbered = /^\s*\d+\s*[.)\-:]/.test(raw);

  // Numbered lines are medicine starts ONLY if the entire line
  // looks like a genuine medicine name.
  if (isNumbered) {
    return looksLikeMedicineName(raw);
  }

  // Unnumbered medicines must begin with a dosage form.
  // Example: "Tab Paracetamol 500 mg"
  if (hasDosageFormAtStart(withoutNumber)) {
    return looksLikeMedicineName(raw);
  }

  return false;
}

function removeRxPrefix(line: string) {
  return stripOcrJunk(line)
    .replace(/^r\s*x\s*[:\-]?\s*/i, "")
    .replace(/^\d+\s*[.)\-:]\s*/i, "")
    .replace(new RegExp(`^${MEDICINE_FORMS}(?:\\.|\\s|:)`, "i"), "")
    .trim();
}

function extractStrength(text: string) {
  const match = text.match(
    /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i,
  );

  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

function extractFrequency(sigLine: string) {
  if (!sigLine) return "";

  return sigLine
    .replace(/^\s*sig\s*[:\-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDuration(lines: string[]) {
  for (const line of lines) {
    const match = line.match(
      /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i,
    );
    if (match) return match[0];
  }

  return "";
}

function extractDispenseInfo(lines: string[]) {
  const parts: string[] = [];

  const dispense = lines.find((line) =>
    /^\s*(dispense|dispense\/supply|supply)\s*[:\-]/i.test(line),
  );

  const refill = lines.find((line) =>
    /^\s*refill\s*[:\-]/i.test(line),
  );

  if (dispense) {
    parts.push(
      dispense
        .replace(
          /^\s*(dispense|dispense\/supply|supply)\s*[:\-]?\s*/i,
          "",
        )
        .trim(),
    );
  }

  if (refill) {
    parts.push(
      `Refill: ${refill
        .replace(/^\s*refill\s*[:\-]?\s*/i, "")
        .trim()}`,
    );
  }

  return parts.join(" | ");
}

function isPrescriptionMetadataLine(line: string) {
  return NON_MEDICINE_START.test(line.trim());
}

function parsePrescriptionText(text: string): MedicineRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean);

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isPrescriptionStart(line)) {
      if (current.length) blocks.push(current);
      current = [line];
      continue;
    }

    // Everything after an Rx start belongs to that medicine until the next Rx start.
    // SIG, dispense/supply, refill, dates and instructions are NEVER medicine starts.
    if (current.length) current.push(line);
  }

  if (current.length) blocks.push(current);

  const rows: MedicineRow[] = [];

  for (const block of blocks) {
    const startLine = block[0];
    if (!startLine || !isPrescriptionStart(startLine)) continue;

    const medicineText = removeRxPrefix(startLine)
      .replace(/\s+/g, " ")
      .replace(/^[|{}[\]():;,.\-]+|[|{}[\]():;,.\-]+$/g, "")
      .trim();

    // Hard gate: only a genuine medicine-start line can create a row.
    if (!looksLikeMedicineName(startLine)) continue;
    if (!medicineText || isPrescriptionMetadataLine(medicineText)) continue;

    // Extra protection: never save SIG/dispense/refill/instruction text
    // as a medicine name.
    if (
      /^(?:sig|dispense|dispense\s*\/\s*supply|supply|refill|start\s*date|take|give|use|apply|drink|once|twice|morning|evening|night|daily|weekly|total|after|before|with|without)\b/i.test(
        medicineText
      )
    ) {
      continue;
    }

    const sigLine =
      block.find((line) => /^\s*sig\s*[:\-]?/i.test(line)) ?? "";

    rows.push({
      medicine: medicineText,
      strength: extractStrength(medicineText),
      frequency: extractFrequency(sigLine),
      duration: extractDuration(block),
      instructions: extractDispenseInfo(block),
      confidence: null,
    });
  }

  const seen = new Set<string>();

  return rows.filter((row) => {
    const name = row.medicine.trim();
    if (!name || !looksLikeMedicineName(name)) return false;

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
        setError(
          "We couldn't reliably read this prescription. Please capture a clearer image."
        );
        return;
      }

      const parsedRows = parsePrescriptionText(text);
      const detectedPatient = extractPatientNameFromOcr(text);

      setOcrText(text);
      setConfidence(Number.isFinite(actualConfidence) ? actualConfidence : null);
      setRows(parsedRows);
      setPatientName(detectedPatient);
      setScannedDate(new Date().toISOString());

      if (!parsedRows.length) {
        setError(
          "OCR found text, but no clear Rx medicine sections were detected. Please verify the prescription manually."
        );
      } else {
        setStatus(
          `${parsedRows.length} medicine${parsedRows.length === 1 ? "" : "s"} detected. SIG, dispense and refill information were grouped with each medicine.`
        );
      }

      if (actualConfidence < 55) {
        setError(
          "Low confidence — please verify every extracted field against the original prescription."
        );
      }
    } catch {
      setError(
        "We couldn't reliably read this prescription. Please try a clearer image."
      );
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
    }
  }

  function updateRow(
    index: number,
    field: keyof MedicineRow,
    value: string
  ) {
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        medicine: "",
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
    if (!ocrText.trim()) {
      setError("Analyze a prescription first.");
      return;
    }

    const validRows = rows.filter((row) => row.medicine.trim());

    if (!validRows.length) {
      setError("No medicine was detected. Please verify the OCR result first.");
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

      /*
        Save the ORIGINAL prescription image in the private
        Supabase Storage bucket first.
      */
      if (!imageBlob) {
        throw new Error("Prescription image is missing.");
      }

      const mime = imageBlob.type || "image/jpeg";
      const extension =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : "jpg";

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
          raw_ocr_text: ocrText,
          ocr_confidence: confidence,
          status: "needs_review",
          image_path: uploadedPath,
          patient_name: patientName.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Store prescription medicines ONLY under this prescription.
      // Do not insert them into public.user_medicines here.
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
            instructions: row.instructions.trim() || null,
            ocr_confidence: row.confidence,
          })),
        );

      if (medicinesError) throw medicinesError;

      setSaved(true);
      setStatus(
        `Prescription saved with ${validRows.length} medicine${validRows.length === 1 ? "" : "s"}. The original image was also saved privately.`
      );
    } catch (saveError) {
      // If database saving failed after image upload, remove the orphan image.
      if (uploadedPath) {
        await supabase.storage.from("prescriptions").remove([uploadedPath]);
      }

      console.error(saveError);
      setError(
        "We couldn't save the prescription and image. Please check your Supabase Storage/table setup and try again."
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

          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </header>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
            Prescription scanner
          </p>

          <h1 className="mt-2 font-display text-4xl font-semibold">
            Scan a real prescription
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Use your camera or upload a prescription image. Visionmate runs
            real OCR and groups each Rx medicine with its SIG, dispense,
            refill and other medicine information.
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
              {!cameraOn && (
                <button
                  onClick={startCamera}
                  className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
                >
                  Open camera
                </button>
              )}

              {cameraOn && (
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
                  OCR result
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold">
                  Review before saving
                </h2>
              </div>

              {confidence !== null && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    confidence >= 75
                      ? "bg-[#E7F3F1] text-signal"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {Math.round(confidence)}% OCR confidence
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
              <p className="mt-4 rounded-xl bg-[#E7F3F1] p-3 text-sm font-semibold text-signal">
                Saved to your private prescription history.
              </p>
            )}

            {!ocrText ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line p-6 text-sm leading-6 text-ink/50">
                No OCR result yet. Capture or upload a real prescription and
                select <strong>Analyze with OCR</strong>.
              </div>
            ) : (
              <>
                <label className="mt-6 block text-xs font-bold uppercase tracking-[.12em] text-ink/45">
                  Raw OCR text
                </label>

                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  rows={8}
                  className="mt-2 w-full rounded-2xl border border-line bg-[#FBFCFC] p-4 text-sm leading-6 outline-none focus:border-signal"
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold text-ink/50">Patient name</span>
                    <input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Not detected — enter manually"
                      className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-signal"
                    />
                  </label>
                  <div>
                    <span className="text-xs font-semibold text-ink/50">Scan date</span>
                    <p className="mt-1 rounded-xl border border-line bg-[#FBFCFC] px-3 py-2.5 text-sm">
                      {scannedDate ? new Date(scannedDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">
                      Detected medicines
                    </p>
                    <p className="mt-1 text-xs text-ink/45">
                      Each Rx block is one medicine. SIG, dispense and refill
                      information stay inside that medicine.
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
                            ["strength", "Strength"],
                            ["frequency", "Frequency / SIG"],
                            ["duration", "Duration"],
                            ["instructions", "Dispense / refill / other information"],
                          ] as const
                        ).map(([field, label]) => (
                          <label
                            key={field}
                            className={
                              field === "instructions"
                                ? "sm:col-span-2"
                                : ""
                            }
                          >
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
          <strong className="text-ink">Safety:</strong> OCR can misread
          printed or handwritten prescriptions. A low or high OCR confidence
          is not proof that the extracted information is correct. Verify every
          medicine, strength, frequency and duration against the original
          prescription and a qualified healthcare professional when needed.
          Visionmate does not prescribe or tell you to change medication.
        </aside>
      </div>
    </main>
  );
}
