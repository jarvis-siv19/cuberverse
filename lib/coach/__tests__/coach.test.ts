import { describe, expect, it } from "vitest"
import { NxnCube, parseSequence } from "@/lib/puzzle"
import {
  COACH_SCHEMA_VERSION,
  CUBE_ORIENTATIONS,
  ReplayFrameSource,
  generateMoveCandidates,
  rankMoveCandidates,
  replayCoachEvents,
  type CoachEvent,
} from "@/lib/coach"

describe("coach orientation model", () => {
  it("enumerates exactly 24 unique proper cube orientations", () => {
    expect(CUBE_ORIENTATIONS).toHaveLength(24)
    expect(new Set(CUBE_ORIENTATIONS.map((orientation) => orientation.key))).toHaveLength(24)
    expect(CUBE_ORIENTATIONS[0].key).toBe("URFDLB")
  })
})

describe("move candidates", () => {
  it("generates no-move plus every single face turn", () => {
    const candidates = generateMoveCandidates(NxnCube.solved(3))
    expect(candidates).toHaveLength(19)
    expect(candidates[0].notation).toBeNull()
    expect(new Set(candidates.map((candidate) => candidate.facelets))).toHaveLength(19)
  })

  it("ranks the matching move first from high-confidence facelet evidence", () => {
    const prior = NxnCube.solved(3)
    const target = prior.clone()
    target.applyMoves(parseSequence("R", "333"))
    const facelets = target.toFaceletString()
    const evidence = [...facelets].map((color, faceletIndex) => ({
      faceletIndex,
      probabilities: { [color]: 0.99 },
    }))
    expect(rankMoveCandidates(prior, evidence)[0].notation).toBe("R")
  })
})

describe("coach replay", () => {
  const sessionId = "session-1"
  const event = (sequence: number, notation: string): CoachEvent => ({
    schemaVersion: COACH_SCHEMA_VERSION,
    sessionId,
    sequence,
    occurredAtMs: 1_000 + sequence,
    type: "move_accepted",
    notation,
    confidence: 1,
    evidenceFrameIds: [],
    acceptedBy: "replay",
  })

  it("rebuilds the same cube state from immutable accepted-move events", () => {
    const events = [event(0, "R"), event(1, "U"), event(2, "R'"), event(3, "U'")]
    const expected = NxnCube.solved(3)
    expected.applyMoves(parseSequence("R U R' U'", "333"))
    expect(replayCoachEvents(undefined, events).facelets).toBe(expected.toFaceletString())
  })

  it("rejects out-of-order events", () => {
    expect(() => replayCoachEvents(undefined, [event(1, "R"), event(0, "U")])).toThrow(
      "strictly increasing",
    )
  })
})

describe("ReplayFrameSource", () => {
  it("is deterministic and resettable", async () => {
    const frame = { id: "f1", capturedAtMs: 1, width: 640, height: 480, source: "replay" as const }
    const source = new ReplayFrameSource([frame])
    await expect(source.next()).resolves.toEqual(frame)
    await expect(source.next()).resolves.toBeNull()
    source.reset()
    await expect(source.next()).resolves.toEqual(frame)
  })
})
