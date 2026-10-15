import type { Face } from "@/lib/puzzle"

export const COACH_SCHEMA_VERSION = 1 as const

export type CoachControlState =
  | "idle"
  | "camera_ready"
  | "calibrating"
  | "tracking"
  | "reacquiring"
  | "uncertain"
  | "camera_lost"
  | "review"

export interface CoachEventBase {
  readonly schemaVersion: typeof COACH_SCHEMA_VERSION
  readonly sessionId: string
  /** Strictly increasing within one session. */
  readonly sequence: number
  /** Milliseconds since Unix epoch. */
  readonly occurredAtMs: number
}

export interface FrameObservedEvent extends CoachEventBase {
  readonly type: "frame_observed"
  readonly frameId: string
  readonly source: "camera" | "replay"
  readonly width: number
  readonly height: number
  readonly captureLatencyMs?: number
}

export interface MoveAcceptedEvent extends CoachEventBase {
  readonly type: "move_accepted"
  readonly notation: string
  readonly confidence: number
  readonly evidenceFrameIds: readonly string[]
  readonly acceptedBy: "model" | "user" | "replay"
}

export interface OrientationChangedEvent extends CoachEventBase {
  readonly type: "orientation_changed"
  /** Center colors in URFDLB camera-face order, e.g. URFDLB for identity. */
  readonly orientationKey: string
  readonly confidence: number
}

export interface TrackingLostEvent extends CoachEventBase {
  readonly type: "tracking_lost"
  readonly reason: "cube_occluded" | "camera_stopped" | "low_confidence" | "frame_gap"
  readonly lastReliableFrameId?: string
}

export interface ManualCorrectionEvent extends CoachEventBase {
  readonly type: "manual_correction"
  readonly correctedSequence: number
  readonly previousNotation?: string
  readonly nextNotation?: string
  readonly reason?: string
}

export interface ControlStateChangedEvent extends CoachEventBase {
  readonly type: "control_state_changed"
  readonly from: CoachControlState
  readonly to: CoachControlState
  readonly reason?: string
}

export type CoachEvent =
  | FrameObservedEvent
  | MoveAcceptedEvent
  | OrientationChangedEvent
  | TrackingLostEvent
  | ManualCorrectionEvent
  | ControlStateChangedEvent

export interface FaceletEvidence {
  readonly faceletIndex: number
  readonly probabilities: Readonly<Partial<Record<Face, number>>>
}

export interface CaptureProvenance {
  readonly source: "first_party" | "licensed_dataset" | "public_video_reference"
  readonly sourceUrl?: string
  readonly license?: string
  readonly consentId?: string
  readonly mayTrain: boolean
  readonly mayRedistribute: boolean
  readonly reviewedAtMs?: number
}

export interface CoachSolveRecordV1 {
  readonly schemaVersion: typeof COACH_SCHEMA_VERSION
  readonly sessionId: string
  readonly puzzle: "333"
  readonly startedAtMs: number
  readonly endedAtMs?: number
  readonly scramble?: string
  readonly events: readonly CoachEvent[]
  readonly provenance: CaptureProvenance
}
