"use client"

import { useEffect, useState } from "react"

type Decision = {
  id: string
  text: string
  review_due_at: string | null
  expected_outcome: string | null
  reviewed_at?: string | null
  outcome_count?: number
}

export default function ReviewsPage() {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)

    const res = await fetch("/api/reviews/load")
    const data = await res.json()

    if (data.ok) {
      setDecision(data.decision)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(outcomeLabel: "worked" | "failed" | "partial") {
    if (!decision) return

    setSubmitting(true)

    await fetch("/api/reviews/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decisionId: decision.id,
        outcomeLabel,
        note,
      }),
    })

    setNote("")
    await load()
    setSubmitting(false)
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!decision) {
    return <div className="p-6">No decisions to review.</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      <h1 className="text-2xl font-semibold">
        Decision Reviews
      </h1>

      <div className="text-sm opacity-60">
        Due: {decision.review_due_at}
      </div>

      {/* Decision */}
      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm opacity-60 mb-1">Decision</p>
        <p className="text-base">{decision.text}</p>
      </div>

      {/* Expected outcome */}
      {decision.expected_outcome && (
        <div className="p-4 border rounded-lg bg-neutral-50">
          <p className="text-sm opacity-60 mb-1">Expected outcome</p>
          <p className="text-base">{decision.expected_outcome}</p>
        </div>
      )}

      {/* History */}
      <div className="p-4 border rounded-lg bg-neutral-50">
        <p className="text-sm opacity-60 mb-1">Review history</p>
        <p className="text-base">
          Reviewed {decision.outcome_count ?? 0} time(s)
        </p>
      </div>

      {/* Note */}
      <div>
        <p className="text-sm mb-1">Review note</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded-md p-2"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          disabled={submitting}
          onClick={() => submit("worked")}
          className="px-4 py-2 border rounded-md"
        >
          Worked
        </button>

        <button
          disabled={submitting}
          onClick={() => submit("partial")}
          className="px-4 py-2 border rounded-md"
        >
          Partial
        </button>

        <button
          disabled={submitting}
          onClick={() => submit("failed")}
          className="px-4 py-2 border rounded-md"
        >
          Failed
        </button>
      </div>

    </div>
  )
}