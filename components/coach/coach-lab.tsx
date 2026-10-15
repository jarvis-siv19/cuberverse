"use client"

import { useCallback, useId, useMemo, useRef, useState } from "react"
import {
  Activity,
  Braces,
  CircleDotDashed,
  Database,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { CameraStage, type CameraMetrics } from "@/components/coach/camera-stage"
import { LazyPuzzleViewer } from "@/components/puzzle-viewer/lazy"
import { usePuzzleController } from "@/components/puzzle-viewer/use-puzzle-controller"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  COACH_SCHEMA_VERSION,
  SINGLE_TURN_NOTATIONS,
  replayCoachEvents,
  type CoachControlState,
  type CoachEvent,
  type CoachEventBase,
} from "@/lib/coach"

type CoachEventPayload<Event extends CoachEvent = CoachEvent> = Event extends CoachEvent
  ? Omit<Event, keyof CoachEventBase>
  : never

const FIXTURE_SCRAMBLE = "R U2 F' L2 D B2 U' R2"
const FIXTURE_MOVES = ["U", "R", "U'", "R'", "F2", "D"] as const

const STATE_LABELS: Record<CoachControlState, string> = {
  idle: "Idle",
  camera_ready: "Camera ready",
  calibrating: "Calibrating",
  tracking: "Tracking demo",
  reacquiring: "Reacquiring",
  uncertain: "Uncertain",
  camera_lost: "Camera stopped",
  review: "Review",
}

const EMPTY_METRICS: CameraMetrics = {
  width: 0,
  height: 0,
  fps: 0,
  framesSeen: 0,
  droppedFrames: 0,
}

function eventSummary(event: CoachEvent): string {
  switch (event.type) {
    case "move_accepted":
      return `${event.notation} accepted · ${Math.round(event.confidence * 100)}%`
    case "control_state_changed":
      return `${STATE_LABELS[event.from]} → ${STATE_LABELS[event.to]}`
    case "tracking_lost":
      return `Tracking lost · ${event.reason.replaceAll("_", " ")}`
    case "orientation_changed":
      return `Orientation ${event.orientationKey}`
    case "manual_correction":
      return `Corrected event #${event.correctedSequence}`
    case "frame_observed":
      return `Frame ${event.frameId} · ${event.width}×${event.height}`
  }
}

export function CoachLab() {
  const controller = usePuzzleController("333")
  const generatedSessionId = useId()
  const sessionIdRef = useRef(`local-${generatedSessionId}`)
  const sequenceRef = useRef(0)
  const stateRef = useRef<CoachControlState>("idle")
  const [controlState, setControlState] = useState<CoachControlState>("idle")
  const [events, setEvents] = useState<readonly CoachEvent[]>([])
  const [metrics, setMetrics] = useState<CameraMetrics>(EMPTY_METRICS)
  const [activeScramble, setActiveScramble] = useState<string | undefined>()
  const [notice, setNotice] = useState(
    "Camera diagnostics are live. Move inference is intentionally simulated in this first integration slice.",
  )

  const appendEvent = useCallback((payload: CoachEventPayload) => {
    const event = {
      schemaVersion: COACH_SCHEMA_VERSION,
      sessionId: sessionIdRef.current,
      sequence: sequenceRef.current++,
      occurredAtMs: Date.now(),
      ...payload,
    } as CoachEvent
    setEvents((current) => [...current, event].slice(-100))
  }, [])

  const transition = useCallback(
    (to: CoachControlState, reason?: string) => {
      const from = stateRef.current
      if (from === to) return
      stateRef.current = to
      setControlState(to)
      appendEvent({ type: "control_state_changed", from, to, reason })
    },
    [appendEvent],
  )

  const handleCameraReady = useCallback(
    (settings: MediaTrackSettings) => {
      transition("camera_ready", "camera permission granted")
      setNotice(
        `Camera ready at ${settings.width ?? "unknown"}×${settings.height ?? "unknown"}. Use the move pad to exercise the event and replay pipeline.`,
      )
    },
    [transition],
  )

  const handleCameraStopped = useCallback(() => {
    appendEvent({ type: "tracking_lost", reason: "camera_stopped" })
    transition("camera_lost", "camera stream ended")
    setMetrics(EMPTY_METRICS)
    setNotice("Camera stopped. The event log and virtual cube remain available for review.")
  }, [appendEvent, transition])

  const handleCameraError = useCallback(
    (message: string) => {
      transition("camera_lost", "camera unavailable")
      setNotice(message)
    },
    [transition],
  )

  const acceptMove = (notation: string) => {
    controller.applyMoves(notation)
    if (stateRef.current !== "tracking") transition("tracking", "manual integration test")
    appendEvent({
      type: "move_accepted",
      notation,
      confidence: 1,
      evidenceFrameIds: [],
      acceptedBy: "user",
    })
    setNotice(`${notation} appended as a user-confirmed move. No model inference was claimed.`)
  }

  const loadReplayFixture = () => {
    sessionIdRef.current = `replay-${Date.now().toString(36)}`
    sequenceRef.current = FIXTURE_MOVES.length
    const start = Date.now()
    const fixtureEvents: CoachEvent[] = FIXTURE_MOVES.map((notation, sequence) => ({
      schemaVersion: COACH_SCHEMA_VERSION,
      sessionId: sessionIdRef.current,
      sequence,
      occurredAtMs: start + sequence * 120,
      type: "move_accepted",
      notation,
      confidence: 0.98,
      evidenceFrameIds: [`fixture-frame-${sequence + 1}`],
      acceptedBy: "replay",
    }))
    setEvents(fixtureEvents)
    setActiveScramble(FIXTURE_SCRAMBLE)
    controller.setBase(FIXTURE_SCRAMBLE)
    controller.applyMoves(FIXTURE_MOVES.join(" "))
    stateRef.current = "review"
    setControlState("review")
    setNotice("A deterministic recorded fixture is replaying through the same cube controller.")
  }

  const resetSession = () => {
    sessionIdRef.current = `local-${Date.now().toString(36)}`
    sequenceRef.current = 0
    stateRef.current = "idle"
    setControlState("idle")
    setEvents([])
    setActiveScramble(undefined)
    controller.resetAll()
    setNotice("Session reset. Start the camera or load the replay fixture.")
  }

  const replay = useMemo(() => replayCoachEvents(activeScramble, events), [activeScramble, events])
  const moveEvents = events.filter((event) => event.type === "move_accepted")

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 grid gap-5 border-b border-border pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Experimental · 3×3 only
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Coach Lab</h1>
          <p className="mt-3 max-w-3xl text-pretty leading-relaxed text-muted-foreground">
            The integration bench for camera capture, exact cube state, and auditable solve events.
            This slice proves the data path before a model is allowed to call moves.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadReplayFixture}>
            <Play className="h-4 w-4" />
            Load replay fixture
          </Button>
          <Button variant="ghost" onClick={resetSession}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </header>

      <div className="mb-5 flex items-start gap-3 border-l-2 border-accent bg-accent/10 px-4 py-3 text-sm">
        <CircleDotDashed className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <span className="font-semibold">{STATE_LABELS[controlState]}.</span>{" "}
          <span className="text-muted-foreground">{notice}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 space-y-5">
          <CameraStage
            onReady={handleCameraReady}
            onStopped={handleCameraStopped}
            onError={handleCameraError}
            onMetrics={setMetrics}
          />

          <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Accepted-move pad</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Temporary human input for testing state, animation, and event replay.
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">19 hypotheses / frame</span>
            </div>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-9"
              aria-label="Cube move controls"
            >
              {SINGLE_TURN_NOTATIONS.map((notation) => (
                <Button
                  key={notation}
                  variant="secondary"
                  size="sm"
                  className="min-w-0 px-2 font-mono"
                  onClick={() => acceptMove(notation)}
                >
                  {notation}
                </Button>
              ))}
            </div>
          </Card>

          <section aria-labelledby="diagnostics-heading" className="border-y border-border py-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="diagnostics-heading" className="font-semibold">
                Capture diagnostics
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ["Input", metrics.width ? `${metrics.width}×${metrics.height}` : "—"],
                ["Observed FPS", metrics.fps ? metrics.fps.toFixed(1) : "—"],
                ["Frames seen", metrics.framesSeen.toLocaleString()],
                ["Browser drops", metrics.droppedFrames.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <Card className="gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Audited cube state</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Existing renderer, driven only by accepted events.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
            </div>
            <div className="h-72 overflow-hidden rounded-lg border bg-background">
              <LazyPuzzleViewer controller={controller} />
            </div>
            <dl className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Accepted</dt>
                <dd className="mt-1 font-mono text-lg font-semibold">{replay.moveCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lost</dt>
                <dd className="mt-1 font-mono text-lg font-semibold">{replay.trackingLossCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Corrections</dt>
                <dd className="mt-1 font-mono text-lg font-semibold">{replay.correctionCount}</dd>
              </div>
            </dl>
          </Card>

          <Card className="gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-semibold">Event stream</h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">schema v1</span>
            </div>
            <div className="max-h-80 overflow-y-auto border-t border-border">
              {events.length === 0 ? (
                <div className="py-8 text-center">
                  <Database className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm text-muted-foreground">No events yet.</p>
                </div>
              ) : (
                <ol className="divide-y divide-border">
                  {[...events].reverse().map((event) => (
                    <li key={`${event.sessionId}-${event.sequence}`} className="flex gap-3 py-3 text-sm">
                      <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                        #{event.sequence}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{eventSummary(event)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {event.type} · {new Date(event.occurredAtMs).toLocaleTimeString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>

          <div className="flex gap-3 border border-chart-5/30 bg-chart-5/10 p-4 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-chart-5" aria-hidden="true" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Boundary:</span> camera pixels are not
              yet classified. {moveEvents.length} move{moveEvents.length === 1 ? " is" : "s are"}
              currently sourced from a person or the replay fixture.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
