import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CoachLab } from "@/components/coach/coach-lab"
import { Navigation } from "@/components/navigation"

export const metadata: Metadata = {
  title: "Coach Lab",
  description: "Experimental camera capture, cube-state replay, and coaching infrastructure.",
  robots: { index: false, follow: false },
}

export default function CoachLabPage() {
  if (process.env.NEXT_PUBLIC_COACH_LAB === "false") notFound()

  return (
    <div>
      <Navigation />
      <CoachLab />
    </div>
  )
}
