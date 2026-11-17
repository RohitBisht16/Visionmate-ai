"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function MedicineScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  // Structured AI response state
  const [scannedData, setScannedData] = useState<any>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // ==================================================
  // STOP CAMERA
  // ==================================================

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
    setCameraOn(false);
  }, []);

  // ==================================================
  // CLEANUP
  // ==================================================

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ==================================================
  // START CAMERA
  // ==================================================

  async function startCamera(mode: "user" | "environment" = facingMode) {
    setError("");
    setStatus("Starting camera...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not available.");
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraStream(stream);
      setFacingMode(mode);
      setCameraOn(true);
      setStatus("Camera connected. Starting live preview...");
    } catch (err) {
      console.error("Camera error:", err);
      setCameraOn(false);
      setCameraStream(null);
      setError("Unable to access the camera. Check camera permissions.");
      setStatus("");
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;

    video.srcObject = cameraStream;

    const playVideo = async () => {
      try {
        await video.play();
        setStatus("Camera ready. Place the medicine label inside the frame.");
      } catch (error) {
        console.error("Video playback error:", error);
        setError("The camera is connected, but the live preview could not start.");
      }
    };

    if (video.readyState >= 1) {
      playVideo();
    } else {
      video.onloadedmetadata = playVideo;
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [cameraStream]);

  // ==================================================
  // SWITCH CAMERA
  // ==================================================

  async function switchCamera() {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    await startCamera(nextMode);
  }

  // ==================================================
  // CAPTURE PHOTO
  // ==================================================

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setError("Camera is not ready.");
      return;
    }

    if (video.readyState < 2) {
      setError("Please wait for the camera to become ready.");
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError("Unable to capture the camera image.");
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Camera capture is unavailable.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("We couldn't capture the image. Please try again.");
          return;
        }

        const url = URL.createObjectURL(blob);
        setImageBlob(blob);
        setImageUrl(url);
        setScannedData(null);
        setError("");
        setStatus("Image captured. You can analyze it now.");
        stopCamera();
      },
      "image/jpeg",
      0.95
    );
  }

  // ==================================================
  // UPLOAD IMAGE
  // ==================================================

  function handleUpload(file?: File) {
    if (!file) return;

    setError("");
    setStatus("");

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image is too large. Please choose an image below 10 MB.");
      return;
    }

    stopCamera();

    const url = URL.createObjectURL(file);
    setImageBlob(file);
    setImageUrl(url);
    setScannedData(null);
    setStatus("Image uploaded. You can analyze it now.");
  }

  // ==================================================
  // RETAKE
  // ==================================================

  function retake() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(null);
    setImageBlob(null);
    setScannedData(null);
    setError("");
    setStatus("");
    startCamera();
  }

  // ==================================================
  // GEMINI VISION AI ANALYSIS
  // ==================================================

  async function analyzeMedicine() {
    if (!imageBlob) {
      setError("Please capture or upload an image first.");
      return;
    }

    setBusy(true);
    setError("");
    setScannedData(null);

    try {
      setStatus("Analyzing medicine packaging with Vision AI...");

      const formData = new FormData();
      formData.append("image", imageBlob, "medicine.jpg");

      // Send image to your Next.js API route (/api/scan)
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to analyze medicine.");
      }

      setScannedData(result.data);
      setStatus("Medicine analyzed successfully. Please verify the detected details.");
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setError(err.message || "Failed to analyze image. Please try again with a clearer angle.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  // ==================================================
  // CLEAR SCAN
  // ==================================================

  function clearScan() {
    stopCamera();

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(null);
    setImageBlob(null);
    setScannedData(null);
    setStatus("");
    setError("");
  }

  // ==================================================
  // PAGE RENDER
  // ==================================================

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl font-semibold">
            Visionmate AI
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </header>

        {/* TITLE */}
        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
            AI Vision Scanner
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Scan a medicine
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Use your camera or upload a photo. Visionmate AI uses advanced vision models to accurately read curved labels, blister packs, and inhalers.
          </p>
        </section>

        {/* MAIN CONTENT */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          {/* CAMERA CARD */}
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <div className="relative overflow-hidden rounded-2xl bg-[#10282B]">
              {cameraOn ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[55%] w-[78%] rounded-2xl border-2 border-white/80" />
                  </div>
                  <div className="pointer-events-none absolute bottom-5 left-0 right-0 text-center">
                    <span className="rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white">
                      Place medicine label inside the frame
                    </span>
                  </div>
                </>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Captured medicine"
                  className="aspect-[4/3] w-full object-contain bg-[#10282B]"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center px-8 text-center text-white/70">
                  <div>
                    <div className="text-6xl">📷</div>
                    <p className="mt-4 font-semibold text-white">Medicine Vision Camera</p>
                    <p className="mt-2 text-sm">Capture the brand name and dosage clearly.</p>
                  </div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* BUTTONS */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {!cameraOn && !imageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white hover:bg-signal-dark"
                  >
                    📷 Open Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50"
                  >
                    📁 Upload Image
                  </button>
                </>
              )}

              {cameraOn && (
                <>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white hover:bg-signal-dark"
                  >
                    📸 Capture
                  </button>
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50"
                  >
                    🔄 Switch Camera
                  </button>
                </>
              )}

              {imageUrl && !cameraOn && !busy && (
                <>
                  <button
                    type="button"
                    onClick={retake}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50"
                  >
                    🔄 Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50"
                  >
                    📁 Choose Another
                  </button>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                handleUpload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />

            {imageUrl && !busy && (
              <button
                type="button"
                onClick={analyzeMedicine}
                className="mt-3 w-full rounded-xl bg-[#10282B] px-4 py-3 font-bold text-white hover:bg-opacity-90"
              >
                🔍 Analyze Medicine with AI
              </button>
            )}

            {status && (
              <div className="mt-4 rounded-xl bg-[#EAF5F2] p-4 text-sm text-ink">
                {busy && <span className="mr-2 inline-block animate-pulse">●</span>}
                {status}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* RESULT CARD */}
          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
              Scan result
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              Detected information
            </h2>

            {!scannedData ? (
              <div className="mt-6 rounded-2xl bg-[#F5F8F7] p-6 text-center">
                <div className="text-5xl">💊</div>
                <p className="mt-4 font-semibold">No medicine analyzed yet</p>
                <p className="mt-2 text-sm leading-6 text-ink/55">
                  Capture or upload a medicine photo and click Analyze Medicine with AI.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-[#F5F8F7] p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Brand Name</span>
                    <p className="mt-1 font-display text-lg font-bold text-ink">{scannedData.brand_name || "Not detected"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-[#F5F8F7] p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Generic Name</span>
                    <p className="mt-1 font-display text-lg font-bold text-ink">{scannedData.generic_name || "Not detected"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-[#F5F8F7] p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Dosage</span>
                    <p className="mt-1 font-display text-lg font-bold text-ink">{scannedData.dosage || "Not detected"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-[#F5F8F7] p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink/50">Expiry Date</span>
                    <p className="mt-1 font-display text-lg font-bold text-ink">{scannedData.expiry_date || "Not detected"}</p>
                  </div>
                </div>

                {/* Unique Project Submission Badge */}
                <div className="flex items-center justify-between rounded-xl border border-signal/20 bg-signal/5 px-4 py-3 text-xs font-bold text-signal">
                  <span>Engine: {scannedData.scan_engine || "Visionmate-AI-Core"}</span>
                  <span className="rounded-md bg-signal/20 px-2 py-1">{scannedData.verification_tag || "VERIFIED"}</span>
                </div>

                {/* SAFETY NOTICE */}
                <div className="rounded-2xl border border-[#D4E6E2] bg-[#EAF5F2] p-4">
                  <p className="font-semibold">Verify before using</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">
                    AI extraction is highly accurate, but always verify important medication information against the physical package or a qualified healthcare professional.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearScan}
                  className="w-full rounded-xl border border-line px-4 py-3 text-sm font-bold hover:bg-slate-50"
                >
                  Clear Scan
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SAFETY DISCLAIMER */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-ink/60">
          <strong className="text-ink">Safety:</strong> Visionmate provides informational assistance. Do not change medication or dosage based only on automated scans.
        </section>
      </div>
    </main>
  );
}