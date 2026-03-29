"use client"

import { useEffect, useState } from "react"

type DigestData = {
  facts: { text: string }[]
  decisions: { text_snapshot: string }[]
  outcomes: { text_snapshot: string; outcome_label: string }[]
  insight: string
}

export default function DigestPage() {
  const [data, setData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/digest/weekly")
      .then(res => res.json())
      .then(res => {
        setData(res.summary)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-6">Loading...</div>

  if (!data) return <div className="p-6">No data</div>

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      <h1 className="text-2xl font-semibold">
        Your Week with Memori
      </h1>

      {/* Insight */}
      <div className="p-4 border rounded-lg bg-neutral-50">
        <p className="text-sm text-neutral-600 mb-1">Insight</p>
        <p className="text-base">{data.insight}</p>
      </div>

      {/* Facts */}
      <Section title="What Memori learned">
        {data.facts.map((f, i) => (
          <Item key={i}>{f.text}</Item>
        ))}
      </Section>

      {/* Decisions */}
      <Section title="Decisions you made">
        {data.decisions.map((d, i) => (
          <Item key={i}>{d.text_snapshot}</Item>
        ))}
      </Section>

      {/* Outcomes */}
      <Section title="Outcomes logged">
        {data.outcomes.map((o, i) => (
          <Item key={i}>
            {o.text_snapshot} — <span className="text-sm opacity-60">{o.outcome_label}</span>
          </Item>
        ))}
      </Section>

    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <div>
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Item({ children }: any) {
  return (
    <div className="p-3 border rounded-md bg-white text-sm">
      {children}
    </div>
  )
}