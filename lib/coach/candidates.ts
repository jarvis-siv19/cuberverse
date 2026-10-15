import { FACE_ORDER, NxnCube, parseSequence, type Face, type ParsedMove } from "@/lib/puzzle"
import type { FaceletEvidence } from "./contracts"

export const SINGLE_TURN_NOTATIONS = Object.freeze(
  FACE_ORDER.flatMap((face) => [face, `${face}'`, `${face}2`]),
)

export interface MoveCandidate {
  readonly notation: string | null
  readonly move: ParsedMove | null
  readonly facelets: string
}

export interface ScoredMoveCandidate extends MoveCandidate {
  /** Mean negative log likelihood. Lower is better. */
  readonly score: number
}

/** The only legal one-observation-step hypotheses: no move or one of 18 face turns. */
export function generateMoveCandidates(prior: NxnCube): readonly MoveCandidate[] {
  const candidates: MoveCandidate[] = [
    Object.freeze({ notation: null, move: null, facelets: prior.toFaceletString() }),
  ]

  for (const notation of SINGLE_TURN_NOTATIONS) {
    const cube = prior.clone()
    const [move] = parseSequence(notation, "333")
    cube.applyMove(move)
    candidates.push(Object.freeze({ notation, move, facelets: cube.toFaceletString() }))
  }

  return Object.freeze(candidates)
}

export function rankMoveCandidates(
  prior: NxnCube,
  evidence: readonly FaceletEvidence[],
): readonly ScoredMoveCandidate[] {
  if (evidence.length === 0) return []

  const epsilon = 1e-6
  return generateMoveCandidates(prior)
    .map((candidate) => {
      let loss = 0
      for (const observation of evidence) {
        if (!Number.isInteger(observation.faceletIndex) || observation.faceletIndex < 0 || observation.faceletIndex >= 54) {
          throw new RangeError(`Facelet index must be an integer in [0, 53], got ${observation.faceletIndex}`)
        }
        const color = candidate.facelets[observation.faceletIndex] as Face
        const probability = observation.probabilities[color] ?? epsilon
        loss += -Math.log(Math.max(epsilon, Math.min(1, probability)))
      }
      return Object.freeze({ ...candidate, score: loss / evidence.length })
    })
    .sort((a, b) => a.score - b.score)
}
