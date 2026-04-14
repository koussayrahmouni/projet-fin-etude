"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

type SavedChecklist = {
  id: string
  clientName: string
  updatedAt: string
  createdBy: string
  isOwner: boolean
  progress: number
  totalItems: number
  doneItems: number
}

export default function DashboardPage() {
  const [checklists, setChecklists] = useState<SavedChecklist[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/checklist/list", { credentials: "include" })
      .then((r) => r.json())
      .then((data: SavedChecklist[]) => {
        setChecklists(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const selected = checklists.find((c) => c.id === selectedId) ?? null

  // We don't have per-section data from /list, so we show the 8 fixed sections
  // with their real overall progress distributed — or you can hit /api/checklist/load
  // for section-level breakdown. Here we show per-client summary cards.
  const overallAvg =
    checklists.length > 0
      ? Math.round(checklists.reduce((sum, c) => sum + c.progress, 0) / checklists.length)
      : 0

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-xl font-semibold tracking-tight">Build-to-Run Checklist Dashboard</h1>
        </header>

        <main className="flex-1 p-6 space-y-6">

          {/* ── Top summary ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{checklists.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{overallAvg}%</p>
                <Progress value={overallAvg} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fully Complete</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {checklists.filter((c) => c.progress === 100).length}
                  <span className="text-base font-normal text-muted-foreground ml-1">/ {checklists.length}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Client selector + detail ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle>Client Detail</CardTitle>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loading || checklists.length === 0}
                className="px-3 py-2 bg-background border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {loading && <option>Loading...</option>}
                {!loading && checklists.length === 0 && <option>No checklists found</option>}
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </CardHeader>

            {selected && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{selected.clientName}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      By {selected.createdBy}{selected.isOwner ? " (you)" : ""} · Last updated{" "}
                      {new Date(selected.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href="/checklist"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Open Checklist →
                  </a>
                </div>

                <div className="flex items-center gap-4">
                  <Progress value={selected.progress} className="flex-1" />
                  <span className="text-2xl font-bold w-16 text-right">{selected.progress}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selected.doneItems} / {selected.totalItems} items completed
                </p>
              </CardContent>
            )}
          </Card>

          {/* ── All clients grid ── */}
          {!loading && checklists.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {checklists.map((c) => (
                <Card
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-blue-300 ${c.id === selectedId ? "border-blue-500 ring-1 ring-blue-400" : ""
                    }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{c.clientName}</CardTitle>
                      {c.progress === 100 && (
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Complete
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.createdBy}{c.isOwner ? " (you)" : ""} · {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-2">
                      {c.doneItems}
                      <span className="text-base font-normal text-muted-foreground">/{c.totalItems}</span>
                    </div>
                    <Progress value={c.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">{c.progress}% complete</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && checklists.length === 0 && (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-20 text-center text-slate-500">
              No checklists found. Create one in the B2R Checklist page.
            </div>
          )}

        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}