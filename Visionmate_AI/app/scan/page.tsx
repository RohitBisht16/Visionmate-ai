"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createWorker } from "tesseract.js";

export default function MedicineScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] =
  useState<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  const [ocrText, setOcrText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [facingMode, setFacingMode] = useState<
  "user" | "environment"
>("user");

  // ==================================================
  // STOP CAMERA
  // ==================================================

  const stopCamera = useCallback(() => {
  if (streamRef.current) {
    streamRef.current
      .getTracks()
      .forEach((track) => track.stop());

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
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // ==================================================
  // START CAMERA
  // ==================================================

 async function startCamera(
  mode: "user" | "environment" = facingMode
) {
  setError("");
  setStatus("Starting camera...");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API is not available.");
    }

    // Stop previous camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: mode,
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
        audio: false,
      });

    console.log("Camera stream:", stream);
    console.log(
      "Video tracks:",
      stream.getVideoTracks()
    );

    streamRef.current = stream;
    setCameraStream(stream);
    setFacingMode(mode);
    setCameraOn(true);

    setStatus(
      "Camera connected. Starting live preview..."
    );
  } catch (err) {
    console.error("Camera error:", err);

    setCameraOn(false);
    setCameraStream(null);

    setError(
      "Unable to access the camera. Check Chrome camera permission and make sure another application is not using the webcam."
    );

    setStatus("");
  }
}
useEffect(() => {
  const video = videoRef.current;

  if (!video || !cameraStream) {
    return;
  }

  console.log("Attaching camera stream to video");

  video.srcObject = cameraStream;

  const playVideo = async () => {
    try {
      await video.play();

      console.log("Camera video is playing");

      setStatus(
        "Camera ready. Place the medicine label inside the frame."
      );
    } catch (error) {
      console.error(
        "Video playback error:",
        error
      );

      setError(
        "The camera is connected, but the live preview could not start."
      );
    }
  };

  if (video.readyState >= 1) {
    playVideo();
  } else {
    video.onloadedmetadata = playVideo;
  };

  return () => {
    video.onloadedmetadata = null;
  };
}, [cameraStream]);

  // ==================================================
  // SWITCH CAMERA
  // ==================================================

  async function switchCamera() {
    const nextMode =
      facingMode === "environment"
        ? "user"
        : "environment";

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
      setError(
        "Please wait for the camera to become ready."
      );
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setError(
        "Unable to capture the camera image."
      );
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      setError(
        "Camera capture is unavailable."
      );
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(
            "We couldn't capture the image. Please try again."
          );
          return;
        }

        const url = URL.createObjectURL(blob);

        setImageBlob(blob);
        setImageUrl(url);

        setOcrText("");
        setConfidence(null);
        setError("");

        setStatus(
          "Image captured. You can analyze it now."
        );

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
    if (!file) {
      return;
    }

    setError("");
    setStatus("");

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a JPG, PNG, WEBP or JPEG image."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "Image is too large. Please choose an image below 10 MB."
      );
      return;
    }

    stopCamera();

    const url = URL.createObjectURL(file);

    setImageBlob(file);
    setImageUrl(url);

    setOcrText("");
    setConfidence(null);

    setStatus(
      "Image uploaded. You can analyze it now."
    );
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

    setOcrText("");
    setConfidence(null);

    setError("");
    setStatus("");

    startCamera();
  }

  // ==================================================
  // OCR
  // ==================================================

  async function analyzeMedicine() {
    if (!imageBlob) {
      setError(
        "Please capture or upload an image first."
      );
      return;
    }

    setBusy(true);
    setError("");
    setOcrText("");
    setConfidence(null);

    let worker:
      | Awaited<ReturnType<typeof createWorker>>
      | null = null;

    try {
      setStatus(
        "Reading medicine label..."
      );

      worker = await createWorker("eng");

      setStatus(
        "Extracting text from the medicine..."
      );

      const result =
        await worker.recognize(imageBlob);

      const text =
        result.data.text.trim();

      const actualConfidence =
        Number(result.data.confidence);

      if (!text) {
        setError(
          "We couldn't reliably read this image. Please capture a clearer image."
        );

        setStatus("");
        return;
      }

      setOcrText(text);

      if (Number.isFinite(actualConfidence)) {
        setConfidence(actualConfidence);
      }

      setStatus(
        "Medicine label read successfully. Please verify the detected text."
      );

      if (
        Number.isFinite(actualConfidence) &&
        actualConfidence < 55
      ) {
        setError(
          "The image may be unclear. Please verify the medicine name against the package."
        );
      }
    } catch (ocrError) {
      console.error("OCR error:", ocrError);

      setError(
        "We couldn't reliably read this image. Please try again with a clearer image."
      );

      setStatus("");
    } finally {
      if (worker) {
        await worker.terminate();
      }

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

    setOcrText("");
    setConfidence(null);

    setStatus("");
    setError("");
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

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

        {/* TITLE */}

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
            Medicine scanner
          </p>

          <h1 className="mt-2 font-display text-4xl font-semibold">
            Scan a medicine
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Use your camera to capture a medicine label or
            upload an existing image. Visionmate will read
            the visible text using real OCR.
          </p>
        </section>

        {/* MAIN CONTENT */}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">

          {/* CAMERA CARD */}

          <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">

            {/* CAMERA VIEW */}

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

                  {/* SCAN FRAME */}

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[55%] w-[78%] rounded-2xl border-2 border-white/80" />
                  </div>

                  {/* CAMERA MESSAGE */}

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
                    <div className="text-6xl">
                      📷
                    </div>

                    <p className="mt-4 font-semibold text-white">
                      Medicine camera scanner
                    </p>

                    <p className="mt-2 text-sm">
                      Capture the medicine name and
                      strength clearly.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* HIDDEN CANVAS */}

            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* BUTTONS */}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">

              {!cameraOn && !imageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
                  >
                    📷 Open Camera
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold"
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
                    className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
                  >
                    📸 Capture
                  </button>

                  <button
                    type="button"
                    onClick={switchCamera}
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold"
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
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold"
                  >
                    🔄 Retake
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold"
                  >
                    📁 Choose Another
                  </button>
                </>
              )}

            </div>

            {/* FILE INPUT */}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                handleUpload(
                  event.target.files?.[0]
                );

                event.currentTarget.value = "";
              }}
            />

            {/* ANALYZE BUTTON */}

            {imageUrl && !busy && (
              <button
                type="button"
                onClick={analyzeMedicine}
                className="mt-3 w-full rounded-xl bg-[#10282B] px-4 py-3 font-bold text-white"
              >
                🔍 Analyze Medicine
              </button>
            )}

            {/* STATUS */}

            {status && (
              <div className="mt-4 rounded-xl bg-[#EAF5F2] p-4 text-sm text-ink">
                {busy && (
                  <span className="mr-2 inline-block animate-pulse">
                    ●
                  </span>
                )}

                {status}
              </div>
            )}

            {/* ERROR */}

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

            {!ocrText ? (
              <div className="mt-6 rounded-2xl bg-[#F5F8F7] p-6 text-center">

                <div className="text-5xl">
                  💊
                </div>

                <p className="mt-4 font-semibold">
                  No medicine scanned yet
                </p>

                <p className="mt-2 text-sm leading-6 text-ink/55">
                  Capture or upload a medicine image
                  and choose Analyze Medicine.
                </p>

              </div>
            ) : (
              <div className="mt-6 space-y-4">

                {/* CONFIDENCE */}

                {confidence !== null && (
                  <div className="rounded-2xl border border-line p-4">

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        OCR confidence
                      </span>

                      <span className="font-bold text-signal">
                        {confidence.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-signal"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              confidence,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    </div>

                  </div>
                )}

                {/* OCR TEXT */}

                <div className="rounded-2xl border border-line p-4">

                  <p className="text-xs font-bold uppercase tracking-[.12em] text-ink/45">
                    OCR text
                  </p>

                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F5F8F7] p-4 text-sm leading-6">
                    {ocrText}
                  </div>

                </div>

                {/* SAFETY */}

                <div className="rounded-2xl border border-[#D4E6E2] bg-[#EAF5F2] p-4">

                  <p className="font-semibold">
                    Verify before using
                  </p>

                  <p className="mt-2 text-sm leading-6 text-ink/60">
                    OCR reads text from the image, but
                    it does not by itself confirm the
                    medicine identity. Verify important
                    medication information against the
                    package or a qualified healthcare
                    professional.
                  </p>

                </div>

                {/* CLEAR */}

                <button
                  type="button"
                  onClick={clearScan}
                  className="w-full rounded-xl border border-line px-4 py-3 text-sm font-bold"
                >
                  Clear Scan
                </button>

              </div>
            )}

          </div>

        </section>

        {/* SAFETY DISCLAIMER */}

        <section className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-ink/60">
          <strong className="text-ink">
            Safety:
          </strong>{" "}
          Visionmate provides informational assistance.
          OCR results can be incorrect, especially with
          blurry or damaged labels. Do not change medication
          or dosage based only on this scan.
        </section>

      </div>
    </main>
  );
}