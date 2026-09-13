"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveSitePhoto, type UploadState } from "@/actions/evidence";
import { PHOTO_TYPES, type PhotoType } from "@/lib/types";
import { useT } from "./Intl";

type Fix = { lat: number; lng: number; accuracy: number } | null;

/**
 * Site photos are taken here and nowhere else. There is deliberately no file
 * input on this component — a gallery photo has no verifiable link to a place
 * or a time, which is the entire reason the camera is in the app.
 *
 * The position is read at the moment the frame is grabbed and travels with it.
 * The server writes it into database columns and stamps its own clock, so
 * neither the coordinates nor the time can be edited afterwards.
 */
export default function CameraCapture({ taskId }: { taskId: string }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [live, setLive] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix>(null);
  const [deviceTime, setDeviceTime] = useState<string>("");
  const [photoType, setPhotoType] = useState<PhotoType>("exterior");
  const [problem, setProblem] = useState<string | null>(null);

  const [state, action, pending] = useActionState<UploadState, FormData>(
    saveSitePhoto,
    null,
  );

  // Clear the preview once a save succeeds.
  useEffect(() => {
    if (state?.ok) setShot(null);
  }, [state]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  async function startCamera() {
    setProblem(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setProblem(
        t.researcher.cameraFailed,
      );
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setProblem(t.researcher.locationBlockedPhoto),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Re-read the position at the instant of capture rather than trusting the
    // one taken when the camera opened.
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8_000 },
    );

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    const scale = Math.min(1, 1600 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // A visible stamp for whoever reads the report. It is a convenience, not
    // the security: the trusted copy lives in the database columns.
    const stampLines = [
      new Date().toLocaleString(),
      fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} ±${Math.round(fix.accuracy)}m` : "",
    ].filter(Boolean);
    const pad = Math.round(canvas.width * 0.015);
    const size = Math.max(12, Math.round(canvas.width * 0.026));
    ctx.font = `${size}px monospace`;
    ctx.textBaseline = "bottom";
    const boxH = size * stampLines.length + pad * 1.4;
    ctx.fillStyle = "rgba(6,12,14,0.62)";
    ctx.fillRect(0, canvas.height - boxH, canvas.width, boxH);
    ctx.fillStyle = "#eaf2f3";
    stampLines.forEach((line, i) => {
      ctx.fillText(line, pad, canvas.height - pad * 0.4 - size * (stampLines.length - 1 - i));
    });

    setShot(canvas.toDataURL("image/jpeg", 0.82));
    setDeviceTime(new Date().toISOString());
    stopCamera();
  }

  return (
    <div className="stack">
      {problem && <div className="notice bad">{problem}</div>}
      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && <div className="notice ok">{state.ok}</div>}

      <div className="field">
        <label htmlFor="photoType">{t.researcher.thisPhotoIs}</label>
        <select
          id="photoType"
          value={photoType}
          onChange={(e) => setPhotoType(e.target.value as PhotoType)}
        >
          {PHOTO_TYPES.map((kind) => (
            <option key={kind} value={kind}>
              {kind === "exterior"
                ? t.researcher.outsideSite
                : t.researcher.insideSite}
            </option>
          ))}
        </select>
      </div>

      <div className="camerastage">
        {shot ? (
          <img src={shot} alt="Captured frame, not yet saved" />
        ) : (
          <video ref={videoRef} playsInline muted aria-label="Camera preview" />
        )}
        <div className="hud">
          <span>{fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : t.researcher.noFix}</span>
          {fix && <span>±{Math.round(fix.accuracy)} m</span>}
          <span>{shot ? t.researcher.captured : live ? t.researcher.liveCam : t.researcher.cameraOff}</span>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!shot ? (
        <div className="row">
          {!live ? (
            <button type="button" className="btn primary" onClick={startCamera}>
              {t.researcher.openCamera}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn primary"
                onClick={capture}
                disabled={!fix}
              >
                {fix ? t.researcher.takePhoto : t.researcher.waitingLocation}
              </button>
              <button type="button" className="btn" onClick={stopCamera}>
                {t.common.cancel}
              </button>
            </>
          )}
        </div>
      ) : (
        <form action={action} className="row">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="image" value={shot} />
          <input type="hidden" name="photoType" value={photoType} />
          <input type="hidden" name="lat" value={fix?.lat ?? ""} />
          <input type="hidden" name="lng" value={fix?.lng ?? ""} />
          <input type="hidden" name="accuracy" value={fix?.accuracy ?? ""} />
          <input type="hidden" name="deviceTime" value={deviceTime} />
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? t.common.saving : t.researcher.savePhoto}
          </button>
          <button type="button" className="btn" onClick={() => setShot(null)}>
            {t.researcher.retake}
          </button>
        </form>
      )}

      <p className="small dim" style={{ margin: 0 }}>
        {t.researcher.noGalleryNote}
      </p>
    </div>
  );
}
