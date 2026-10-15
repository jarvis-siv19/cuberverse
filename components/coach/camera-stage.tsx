"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ShieldCheck, Square, VideoOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface CameraMetrics {
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly framesSeen: number
  readonly droppedFrames: number
}

interface CameraStageProps {
  onReady: (settings: MediaTrackSettings) => void
  onStopped: () => void
  onError: (message: string) => void
  onMetrics: (metrics: CameraMetrics) => void
}

export function CameraStage({ onReady, onStopped, onError, onMetrics }: CameraStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const stopCamera = useCallback(
    (notify = true) => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      for (const track of streamRef.current?.getTracks() ?? []) track.stop()
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setStatus("idle")
      if (notify) onStopped()
    },
    [onStopped],
  )

  useEffect(() => () => stopCamera(false), [stopCamera])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Camera capture needs a secure browser context and a supported device."
      setErrorMessage(message)
      setStatus("error")
      onError(message)
      return
    }

    setStatus("starting")
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stopCamera(false)
        return
      }
      video.srcObject = stream
      await video.play()

      const settings = stream.getVideoTracks()[0]?.getSettings() ?? {}
      setStatus("live")
      onReady(settings)

      let lastVideoTime = -1
      let intervalFrames = 0
      let framesSeen = 0
      let lastReportAt = performance.now()

      const inspectFrame = (now: number) => {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime
          intervalFrames += 1
          framesSeen += 1
        }

        const elapsed = now - lastReportAt
        if (elapsed >= 750) {
          const quality = video.getVideoPlaybackQuality?.()
          onMetrics({
            width: video.videoWidth,
            height: video.videoHeight,
            fps: (intervalFrames * 1_000) / elapsed,
            framesSeen,
            droppedFrames: quality?.droppedVideoFrames ?? 0,
          })
          intervalFrames = 0
          lastReportAt = now
        }
        animationRef.current = requestAnimationFrame(inspectFrame)
      }
      animationRef.current = requestAnimationFrame(inspectFrame)
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow access in the browser and try again."
          : "The camera could not be started. Check that another app is not using it."
      setErrorMessage(message)
      setStatus("error")
      onError(message)
    }
  }, [onError, onMetrics, onReady, stopCamera])

  return (
    <section aria-labelledby="camera-heading" className="overflow-hidden rounded-xl border bg-black">
      <div className="relative h-72 w-full sm:h-auto sm:aspect-video sm:min-h-80">
        <video
          ref={videoRef}
          aria-label="Live cube camera"
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />

        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,_#20283a,_#090b10_70%)] px-6 text-center">
            {status === "error" ? (
              <VideoOff className="h-9 w-9 text-destructive" aria-hidden="true" />
            ) : (
              <Camera className="h-9 w-9 text-primary" aria-hidden="true" />
            )}
            <div>
              <h2 id="camera-heading" className="font-semibold">
                {status === "starting" ? "Starting camera…" : "Camera workspace"}
              </h2>
              <p className="mt-1 max-w-md text-sm text-white/60">
                {errorMessage ?? "Keep the full cube and both hands inside the guide."}
              </p>
            </div>
          </div>
        )}

        {status === "live" && (
          <div className="pointer-events-none absolute inset-[14%]" aria-hidden="true">
            <div className="absolute inset-0 border border-white/20" />
            <div className="absolute inset-x-1/3 inset-y-0 border-x border-white/15" />
            <div className="absolute inset-y-1/3 inset-x-0 border-y border-white/15" />
            <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-accent" />
            <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-accent" />
            <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-accent" />
            <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-accent" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-3 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
            Frames stay in this browser
          </p>
          {status === "live" ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => stopCamera(true)}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={startCamera}
              disabled={status === "starting"}
            >
              <Camera className="h-4 w-4" />
              {status === "starting" ? "Starting…" : "Start camera"}
            </Button>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Camera status: {status}. {errorMessage}
      </p>
    </section>
  )
}
