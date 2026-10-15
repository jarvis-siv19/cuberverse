import { NxnCube, parseSequence } from "@/lib/puzzle"
import type { CoachEvent } from "./contracts"

export interface CoachReplayResult {
  readonly facelets: string
  readonly moveCount: number
  readonly trackingLossCount: number
  readonly correctionCount: number
}

function validateTimeline(events: readonly CoachEvent[]): void {
  let previousSequence = -1
  let previousTimestamp = -1
  let sessionId: string | undefined

  for (const event of events) {
    if (sessionId === undefined) sessionId = event.sessionId
    if (event.sessionId !== sessionId) throw new Error("A replay cannot mix session IDs")
    if (event.sequence <= previousSequence) throw new Error("Event sequences must be strictly increasing")
    if (event.occurredAtMs < previousTimestamp) throw new Error("Event timestamps must not move backward")
    previousSequence = event.sequence
    previousTimestamp = event.occurredAtMs
  }
}

export function replayCoachEvents(
  scramble: string | undefined,
  events: readonly CoachEvent[],
): CoachReplayResult {
  validateTimeline(events)
  const cube = NxnCube.solved(3)
  if (scramble?.trim()) cube.applyMoves(parseSequence(scramble, "333"))

  let moveCount = 0
  let trackingLossCount = 0
  let correctionCount = 0

  for (const event of events) {
    if (event.type === "move_accepted") {
      cube.applyMoves(parseSequence(event.notation, "333"))
      moveCount += 1
    } else if (event.type === "tracking_lost") {
      trackingLossCount += 1
    } else if (event.type === "manual_correction") {
      correctionCount += 1
    }
  }

  return Object.freeze({
    facelets: cube.toFaceletString(),
    moveCount,
    trackingLossCount,
    correctionCount,
  })
}
