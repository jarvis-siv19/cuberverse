export interface CoachFrame {
  readonly id: string
  readonly capturedAtMs: number
  readonly width: number
  readonly height: number
  readonly source: "camera" | "replay"
}

/** A pull-based source keeps recorded sessions deterministic and easy to test. */
export interface CoachFrameSource {
  readonly kind: CoachFrame["source"]
  next(): Promise<CoachFrame | null>
  reset(): void
}

export class ReplayFrameSource implements CoachFrameSource {
  readonly kind = "replay" as const
  private cursor = 0

  constructor(private readonly frames: readonly CoachFrame[]) {}

  async next(): Promise<CoachFrame | null> {
    const frame = this.frames[this.cursor] ?? null
    if (frame) this.cursor += 1
    return frame
  }

  reset(): void {
    this.cursor = 0
  }
}
