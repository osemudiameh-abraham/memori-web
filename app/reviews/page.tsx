"use client"

import { useEffect, useState } from "react"

type Decision = {
  id: string
  text: string
  review_due_at: string | null
  expected_outcome: string | null
  reviewed_at?: string | null
  outcome_count?: number
  pattern_signal?: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ReviewsPage() {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/reviews/load")
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setDecision(null)
        setError(data?.error ?? "Unable to load reviews.")
        return
      }

      setDecision(data.decision)
    } catch {
      setDecision(null)
      setError("Unable to load reviews.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit(outcomeLabel: "worked" | "failed" | "partial") {
    if (!decision) return

    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/reviews/submit", {
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

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Unable to submit review.")
        return
      }

      setNote("")
      await load()
    } catch {
      setError("Unable to submit review.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (error && !decision) {
    return <div className="p-6">{error}</div>
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
        Due: {formatDate(decision.review_due_at)}
      </div>

      {error ? (
        <div className="p-3 border rounded-lg bg-red-50 text-sm">
          {error}
        </div>
      ) : null}

      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm opacity-60 mb-1">Decision</p>
        <p className="text-base">{decision.text}</p>
      </div>

      {decision.expected_outcome && (
        <div className="p-4 border rounded-lg bg-neutral-50">
          <p className="text-sm opacity-60 mb-1">Expected outcome</p>
          <p className="text-base">{decision.expected_outcome}</p>
        </div>
      )}

      <div className="p-4 border rounded-lg bg-neutral-50">
        <p className="text-sm opacity-60 mb-1">Review history</p>
        <p className="text-base">
          Reviewed {decision.outcome_count ?? 0} time(s)
        </p>
      </div>

      {decision.pattern_signal ? (
        <div className="p-4 border rounded-lg bg-amber-50">
          <p className="text-sm opacity-60 mb-1">Pattern signal</p>
          <p className="text-base">{decision.pattern_signal}</p>
        </div>
      ) : null}

      <div>
        <p className="text-sm mb-1">Review note</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded-md p-2"
          rows={4}
        />
      </div>

      <div className="flex gap-3">
        <button
          disabled={submitting}
          onClick={() => void submit("worked")}
          className="px-4 py-2 border rounded-md"
        >
          {submitting ? "Submitting..." : "Worked"}
        </button>

        <button
          disabled={submitting}
          onClick={() => void submit("partial")}
          className="px-4 py-2 border rounded-md"
        >
          {submitting ? "Submitting..." : "Partial"}
        </button>

        <button
          disabled={submitting}
          onClick={() => void submit("failed")}
          className="px-4 py-2 border rounded-md"
        >
          {submitting ? "Submitting..." : "Failed"}
        </button>
      </div>
    </div>
  )
}