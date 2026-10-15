import { FACE_ORDER, NxnCube, parseSequence, type Face } from "@/lib/puzzle"

export interface CubeOrientation {
  /** Center colors in URFDLB camera-face order. */
  readonly key: string
  readonly rotations: readonly string[]
  readonly centers: Readonly<Record<Face, Face>>
}

const GENERATORS = ["x", "y", "z"] as const

function orientationKey(cube: NxnCube): string {
  return FACE_ORDER.map((face) => cube.getSticker(face, 1, 1)).join("")
}

function centersFrom(cube: NxnCube): Readonly<Record<Face, Face>> {
  return Object.freeze(
    Object.fromEntries(
      FACE_ORDER.map((face) => [face, cube.getSticker(face, 1, 1) as Face]),
    ) as Record<Face, Face>,
  )
}

function buildOrientations(): readonly CubeOrientation[] {
  const root = NxnCube.solved(3)
  const queue: Array<{ cube: NxnCube; rotations: string[] }> = [{ cube: root, rotations: [] }]
  const seen = new Set<string>()
  const orientations: CubeOrientation[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break

    const key = orientationKey(current.cube)
    if (seen.has(key)) continue
    seen.add(key)
    orientations.push(
      Object.freeze({
        key,
        rotations: Object.freeze([...current.rotations]),
        centers: centersFrom(current.cube),
      }),
    )

    for (const generator of GENERATORS) {
      const next = current.cube.clone()
      next.applyMoves(parseSequence(generator, "333"))
      queue.push({ cube: next, rotations: [...current.rotations, generator] })
    }
  }

  if (orientations.length !== 24) {
    throw new Error(`Expected 24 cube orientations, generated ${orientations.length}`)
  }

  return Object.freeze(orientations)
}

/** All proper whole-cube rotations; reflections are deliberately excluded. */
export const CUBE_ORIENTATIONS = buildOrientations()

export function findOrientation(key: string): CubeOrientation | undefined {
  return CUBE_ORIENTATIONS.find((orientation) => orientation.key === key)
}
