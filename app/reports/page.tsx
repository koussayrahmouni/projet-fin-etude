"use client"

import { useEffect, useState, useMemo } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

// ─── Types ───────────────────────────────────────────────────────────────────
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

type ChecklistItem = {
    id: string
    name: string
    owner: string
    status: "not_started" | "in_progress" | "done" | "na"
}

type ChecklistSection = {
    number: number
    name: string
    items: ChecklistItem[]
}

type ChecklistDetail = {
    client_name: string
    data: { sections: ChecklistSection[] }
}

type ErrorIssue = {
    category: string
    title: string
    count: number
    examples: string[]
    sample_answer: string
}

type ErrorPatterns = {
    generated_at: string
    total_problem_qa: number
    total_clusters: number
    category_totals: Record<string, number>
    top_issues: ErrorIssue[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTIONS = [
    "JIRA", "DOLLAR UNIVERSE", "PLAN DE PROD.",
    "ENV. APPLICATIF", "MONITORING", "LIVRABLES",
    "SYSTÈME & INFRA", "SECURITY",
]

const OWNERS = ["NSS Delivery", "APP Delivery", "NSS Architecture", "Security"]

// Noise titles to filter out (not real operational issues)
const NOISE_PATTERNS = [
    "absent", "congé", "fiche cliente", "quelques informations",
    "semaines", "informations +", "aurelien", "novapost demandes",
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    "Monitoring": { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
    "Dollar Universe": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    "JIRA": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    "Sécurité": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    "Plan de Production": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    "Système & Infra": { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" },
    "Environnement Applicatif": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
    "Livrables": { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
    "Général": { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" },
}

function ownerKey(raw: string): string {
    if (raw.includes("APP")) return "APP Delivery"
    if (raw.includes("ARCHITECTURE")) return "NSS Architecture"
    if (raw.toUpperCase().includes("SECURITY")) return "Security"
    return "NSS Delivery"
}

function daysAgo(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function riskLevel(c: SavedChecklist): "high" | "medium" | "low" {
    const days = daysAgo(c.updatedAt)
    if (c.progress < 30 && days > 7) return "high"
    if (c.progress < 70 && days > 14) return "medium"
    return "low"
}

function isNoise(title: string): boolean {
    const lower = title.toLowerCase()
    return NOISE_PATTERNS.some((p) => lower.includes(p))
}

const apiFetch = (url: string) => fetch(url, { credentials: "include" })

// ─── Heatmap cell ─────────────────────────────────────────────────────────────
function HeatCell({ pct, label }: { pct: number | null; label: string }) {
    const bg =
        pct === null ? "bg-slate-100 text-slate-300"
            : pct === 100 ? "bg-emerald-500 text-white"
                : pct >= 66 ? "bg-amber-400 text-white"
                    : pct >= 33 ? "bg-orange-400 text-white"
                        : "bg-red-500 text-white"

    return (
        <div
            className={`${bg} rounded-md flex items-center justify-center text-[10px] font-bold h-9 transition-all hover:scale-105 cursor-default`}
            title={label}
        >
            {pct === null ? "—" : `${pct}%`}
        </div>
    )
}

// ─── Issue card ───────────────────────────────────────────────────────────────
function IssueCard({ issue, rank, maxCount }: { issue: ErrorIssue; rank: number; maxCount: number }) {
    const [expanded, setExpanded] = useState(false)
    const colors = CATEGORY_COLORS[issue.category] || CATEGORY_COLORS["Général"]
    const barWidth = Math.round((issue.count / maxCount) * 100)

    return (
        <div className="border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 transition-all">
            <button
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded((v) => !v)}
            >
                {/* Rank */}
                <span className="text-xs font-bold text-slate-300 w-5 mt-0.5 flex-shrink-0">#{rank}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                            {issue.category}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 truncate">{issue.title}</span>
                    </div>
                    {/* Frequency bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[200px]">
                            <div
                                className={`h-1.5 rounded-full ${colors.dot.replace("bg-", "bg-")}`}
                                style={{ width: `${barWidth}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">{issue.count}x</span>
                    </div>
                </div>

                {/* Expand arrow */}
                <svg
                    className={`w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50 space-y-3">
                    {/* Example questions */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Questions fréquentes ({issue.examples.length} exemples)
                        </p>
                        <ul className="space-y-1">
                            {issue.examples.map((ex, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <span className="text-slate-300 mt-0.5">›</span>
                                    <span>{ex}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Sample answer */}
                    {issue.sample_answer && issue.sample_answer.trim() && issue.sample_answer !== "Ø" && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Réponse Maia (extrait)
                            </p>
                            <div className="text-xs text-slate-600 bg-white border border-slate-100 rounded-lg p-3 leading-relaxed line-clamp-4">
                                {issue.sample_answer}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const [checklists, setChecklists] = useState<SavedChecklist[]>([])
    const [details, setDetails] = useState<Record<string, ChecklistDetail>>({})
    const [errorPatterns, setErrorPatterns] = useState<ErrorPatterns | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [activeTab, setActiveTab] = useState<"checklist" | "errors">("checklist")
    const [categoryFilter, setCategoryFilter] = useState<string>("all")
    const [expandAll, setExpandAll] = useState(false)

    // ── Load checklist list ─────────────────────────────────────────────────
    useEffect(() => {
        apiFetch("/api/checklist/list")
            .then((r) => r.json())
            .then((data: SavedChecklist[]) => setChecklists(data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    // ── Load error patterns from public folder ──────────────────────────────
    useEffect(() => {
        fetch("/error_patterns.json")
            .then((r) => r.json())
            .then((data: ErrorPatterns) => setErrorPatterns(data))
            .catch(() => setErrorPatterns(null))
    }, [])

    // ── Load all checklist details ──────────────────────────────────────────
    useEffect(() => {
        if (checklists.length === 0) return
        setLoadingDetails(true)
        Promise.all(
            checklists.map((c) =>
                apiFetch(`/api/checklist/load?id=${c.id}`)
                    .then((r) => r.json())
                    .then((d) => ({ id: c.id, detail: d as ChecklistDetail }))
                    .catch(() => null)
            )
        ).then((results) => {
            const map: Record<string, ChecklistDetail> = {}
            for (const r of results) if (r) map[r.id] = r.detail
            setDetails(map)
            setLoadingDetails(false)
        })
    }, [checklists])

    // ── Derived: heatmap ────────────────────────────────────────────────────
    const heatmap = useMemo(() => {
        return checklists.map((c) => {
            const detail = details[c.id]
            if (!detail?.data?.sections) return { client: c.clientName, sections: Array(8).fill(null) }
            return {
                client: c.clientName,
                sections: detail.data.sections.map((s) => {
                    const applicable = s.items.filter((i) => i.status !== "na")
                    if (applicable.length === 0) return 100
                    return Math.round((applicable.filter((i) => i.status === "done").length / applicable.length) * 100)
                }),
            }
        })
    }, [checklists, details])

    // ── Derived: owner workload ─────────────────────────────────────────────
    const ownerWorkload = useMemo(() => {
        const counts: Record<string, { done: number; pending: number; in_progress: number }> = {}
        for (const owner of OWNERS) counts[owner] = { done: 0, pending: 0, in_progress: 0 }
        for (const detail of Object.values(details)) {
            if (!detail?.data?.sections) continue
            for (const section of detail.data.sections) {
                for (const item of section.items) {
                    if (item.status === "na") continue
                    const key = ownerKey(item.owner)
                    if (!counts[key]) counts[key] = { done: 0, pending: 0, in_progress: 0 }
                    if (item.status === "done") counts[key].done++
                    else if (item.status === "in_progress") counts[key].in_progress++
                    else counts[key].pending++
                }
            }
        }
        return counts
    }, [details])

    // ── Derived: section bottlenecks ────────────────────────────────────────
    const sectionBottlenecks = useMemo(() => {
        return SECTIONS.map((_, si) => {
            let done = 0, total = 0
            for (const row of heatmap) {
                const pct = row.sections[si]
                if (pct !== null) { done += pct; total++ }
            }
            return { name: SECTIONS[si], avg: total > 0 ? Math.round(done / total) : 0 }
        }).sort((a, b) => a.avg - b.avg)
    }, [heatmap])

    // ── Derived: risk clients ───────────────────────────────────────────────
    const riskClients = useMemo(() => {
        return checklists
            .map((c) => ({ ...c, risk: riskLevel(c), days: daysAgo(c.updatedAt) }))
            .filter((c) => c.risk !== "low")
            .sort((a, b) => (a.risk === "high" ? -1 : 1))
    }, [checklists])

    // ── Derived: recent activity ────────────────────────────────────────────
    const recentActivity = useMemo(() => {
        return [...checklists]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 6)
    }, [checklists])

    // ── Derived: filtered error issues ─────────────────────────────────────
    const filteredIssues = useMemo(() => {
        if (!errorPatterns) return []
        return errorPatterns.top_issues
            .filter((i) => !isNoise(i.title))
            .filter((i) => categoryFilter === "all" || i.category === categoryFilter)
    }, [errorPatterns, categoryFilter])

    const maxCount = useMemo(() => {
        return Math.max(...(filteredIssues.map((i) => i.count)), 1)
    }, [filteredIssues])

    const categories = useMemo(() => {
        if (!errorPatterns) return []
        return Object.keys(errorPatterns.category_totals)
    }, [errorPatterns])

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Header */}
                <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 sticky top-0 z-10">
                    <SidebarTrigger className="-ml-1" />
                    <div className="h-5 w-px bg-slate-200" />
                    <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    <h1 className="text-base font-semibold tracking-tight text-slate-900">Reports & Analytics</h1>
                    {loadingDetails && (
                        <span className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Loading section data...
                        </span>
                    )}
                </header>

                <div className="p-5 bg-slate-50 min-h-[calc(100vh-56px)]">
                    <div className="max-w-[1600px] mx-auto w-full space-y-5">

                        {/* ── Tab switcher ─────────────────────────────────────────── */}
                        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
                            {[
                                { key: "checklist", label: "📋 Checklist Reports" },
                                { key: "errors", label: "🔥 Recurring Issues" },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as "checklist" | "errors")}
                                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-20 text-center">
                                <svg className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                <p className="text-sm text-slate-500">Loading reports...</p>
                            </div>
                        ) : (

                            <>
                                {/* ══════════════════════════════════════════════════════════
                    TAB 1 — CHECKLIST REPORTS
                ══════════════════════════════════════════════════════════ */}
                                {activeTab === "checklist" && (
                                    <div className="space-y-5">

                                        {checklists.length === 0 ? (
                                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-20 text-center">
                                                <div className="text-5xl mb-4">📋</div>
                                                <p className="text-lg font-semibold text-slate-700">No data yet</p>
                                                <p className="text-sm text-slate-400 mt-1">Create checklists in the B2R Checklist page.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Risk + Activity */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                                    {/* Risk radar */}
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                            <span>⚠️</span>
                                                            <h2 className="text-sm font-semibold text-slate-900">At-Risk Clients</h2>
                                                            <span className="ml-auto text-xs text-slate-400">{riskClients.length} flagged</span>
                                                        </div>
                                                        <div className="divide-y divide-slate-50">
                                                            {riskClients.length === 0 ? (
                                                                <div className="px-5 py-8 text-center text-sm text-slate-400">✅ All clients on track</div>
                                                            ) : riskClients.map((c) => (
                                                                <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.risk === "high" ? "bg-red-500" : "bg-amber-400"}`} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-slate-800 truncate">{c.clientName}</p>
                                                                        <p className="text-xs text-slate-400">{c.progress}% done · last updated {c.days}d ago</p>
                                                                    </div>
                                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${c.risk === "high" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                                                                        {c.risk === "high" ? "High Risk" : "Medium Risk"}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Activity */}
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                            <span>🕐</span>
                                                            <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
                                                        </div>
                                                        <div className="divide-y divide-slate-50">
                                                            {recentActivity.map((c) => {
                                                                const days = daysAgo(c.updatedAt)
                                                                return (
                                                                    <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-600">
                                                                            {c.clientName.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-slate-800 truncate">{c.clientName}</p>
                                                                            <p className="text-xs text-slate-400">By {c.createdBy} · {days === 0 ? "today" : `${days}d ago`}</p>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0">
                                                                            <p className="text-sm font-bold text-slate-700">{c.progress}%</p>
                                                                            <p className="text-xs text-slate-400">{c.doneItems}/{c.totalItems}</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section bottlenecks */}
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                        <span>🔻</span>
                                                        <h2 className="text-sm font-semibold text-slate-900">Section Bottlenecks</h2>
                                                        <span className="ml-auto text-xs text-slate-400">Avg across all clients · sorted lowest first</span>
                                                    </div>
                                                    <div className="p-5 space-y-3">
                                                        {loadingDetails ? (
                                                            <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
                                                        ) : sectionBottlenecks.map((s) => (
                                                            <div key={s.name} className="flex items-center gap-3">
                                                                <span className="text-xs font-medium text-slate-600 w-36 flex-shrink-0 truncate">{s.name}</span>
                                                                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                                                    <div
                                                                        className={`h-3 rounded-full transition-all duration-700 ${s.avg === 100 ? "bg-emerald-500" : s.avg >= 66 ? "bg-amber-400" : s.avg >= 33 ? "bg-orange-400" : "bg-red-500"}`}
                                                                        style={{ width: `${s.avg}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${s.avg === 100 ? "text-emerald-600" : s.avg >= 66 ? "text-amber-600" : s.avg >= 33 ? "text-orange-600" : "text-red-600"}`}>
                                                                    {s.avg}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Owner workload */}
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                        <span>👤</span>
                                                        <h2 className="text-sm font-semibold text-slate-900">Owner Workload</h2>
                                                        <span className="ml-auto text-xs text-slate-400">Across all clients</span>
                                                    </div>
                                                    <div className="p-5">
                                                        {loadingDetails ? (
                                                            <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                                {OWNERS.map((owner) => {
                                                                    const w = ownerWorkload[owner] || { done: 0, pending: 0, in_progress: 0 }
                                                                    const total = w.done + w.pending + w.in_progress
                                                                    const pct = total > 0 ? Math.round((w.done / total) * 100) : 0
                                                                    return (
                                                                        <div key={owner} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{owner}</p>
                                                                            <p className="text-2xl font-bold text-slate-900 mt-2">{pct}%</p>
                                                                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 mb-3">
                                                                                <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                {[
                                                                                    { label: "✅ Done", val: w.done, cls: "text-emerald-600" },
                                                                                    { label: "🔄 In Progress", val: w.in_progress, cls: "text-blue-600" },
                                                                                    { label: "⏳ Pending", val: w.pending, cls: "text-red-500" },
                                                                                ].map((row) => (
                                                                                    <div key={row.label} className="flex justify-between text-xs">
                                                                                        <span className="text-slate-500">{row.label}</span>
                                                                                        <span className={`font-semibold ${row.cls}`}>{row.val}</span>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="flex justify-between text-xs border-t border-slate-200 pt-1 mt-1">
                                                                                    <span className="text-slate-400">Total</span>
                                                                                    <span className="font-semibold text-slate-600">{total}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Heatmap */}
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                        <span>🗺️</span>
                                                        <h2 className="text-sm font-semibold text-slate-900">Section Heatmap</h2>
                                                        <span className="ml-auto text-xs text-slate-400">Client × section completion %</span>
                                                    </div>
                                                    <div className="p-5 overflow-x-auto">
                                                        {loadingDetails ? (
                                                            <p className="text-sm text-slate-400 text-center py-4">Loading heatmap...</p>
                                                        ) : (
                                                            <>
                                                                <table className="w-full min-w-[700px]">
                                                                    <thead>
                                                                        <tr>
                                                                            <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 w-36">Client</th>
                                                                            {SECTIONS.map((s) => (
                                                                                <th key={s} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-3 px-1 text-center leading-tight">
                                                                                    {s.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
                                                                                </th>
                                                                            ))}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {heatmap.map((row) => (
                                                                            <tr key={row.client}>
                                                                                <td className="py-1 pr-3">
                                                                                    <span className="text-xs font-semibold text-slate-700 truncate block max-w-[130px]" title={row.client}>
                                                                                        {row.client}
                                                                                    </span>
                                                                                </td>
                                                                                {row.sections.map((pct, si) => (
                                                                                    <td key={si} className="py-1 px-1">
                                                                                        <HeatCell pct={pct} label={`${row.client} — ${SECTIONS[si]}: ${pct ?? "N/A"}%`} />
                                                                                    </td>
                                                                                ))}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                                                                    <span className="text-xs text-slate-400 font-medium">Legend:</span>
                                                                    {[
                                                                        { color: "bg-emerald-500", label: "100%" },
                                                                        { color: "bg-amber-400", label: "66–99%" },
                                                                        { color: "bg-orange-400", label: "33–65%" },
                                                                        { color: "bg-red-500", label: "0–32%" },
                                                                        { color: "bg-slate-100", label: "No data" },
                                                                    ].map((l) => (
                                                                        <div key={l.label} className="flex items-center gap-1.5">
                                                                            <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                                                                            <span className="text-xs text-slate-500">{l.label}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* ══════════════════════════════════════════════════════════
                    TAB 2 — RECURRING ISSUES (from Maia knowledge base)
                ══════════════════════════════════════════════════════════ */}
                                {activeTab === "errors" && (
                                    <div className="space-y-5">
                                        {!errorPatterns ? (
                                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-20 text-center">
                                                <div className="text-5xl mb-4">🤖</div>
                                                <p className="text-lg font-semibold text-slate-700">No error patterns file found</p>
                                                <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                                                    Run the Python analysis script on your Maia dataset and copy{" "}
                                                    <code className="bg-slate-100 px-1 rounded">error_patterns.json</code> to{" "}
                                                    <code className="bg-slate-100 px-1 rounded">/public/</code>
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Summary cards */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Problem Q&A pairs</p>
                                                        <p className="text-3xl font-bold text-slate-900 mt-2">{errorPatterns.total_problem_qa.toLocaleString()}</p>
                                                        <p className="text-xs text-slate-400 mt-1">out of 6,635 total entries in Maia</p>
                                                    </div>
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distinct issue clusters</p>
                                                        <p className="text-3xl font-bold text-slate-900 mt-2">{errorPatterns.total_clusters}</p>
                                                        <p className="text-xs text-slate-400 mt-1">unique problem patterns found</p>
                                                    </div>
                                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top category</p>
                                                        <p className="text-3xl font-bold text-slate-900 mt-2">
                                                            {Object.entries(errorPatterns.category_totals)[0]?.[0] ?? "—"}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            {Object.entries(errorPatterns.category_totals)[0]?.[1] ?? 0} occurrences
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Category breakdown bar chart */}
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                                        <span>📊</span>
                                                        <h2 className="text-sm font-semibold text-slate-900">Issues by Category</h2>
                                                        <span className="ml-auto text-xs text-slate-400">From Maia knowledge base</span>
                                                    </div>
                                                    <div className="p-5 space-y-3">
                                                        {(() => {
                                                            const maxVal = Math.max(...Object.values(errorPatterns.category_totals))
                                                            return Object.entries(errorPatterns.category_totals).map(([cat, count]) => {
                                                                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Général"]
                                                                return (
                                                                    <div key={cat} className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                                                                        <span className="text-xs font-medium text-slate-600 w-40 flex-shrink-0">{cat}</span>
                                                                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                                                            <div
                                                                                className={`h-3 rounded-full transition-all duration-700 ${colors.dot}`}
                                                                                style={{ width: `${Math.round((count / maxVal) * 100)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-bold text-slate-600 w-8 text-right flex-shrink-0">{count}</span>
                                                                    </div>
                                                                )
                                                            })
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Issue list */}
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                                                        <span>🔥</span>
                                                        <h2 className="text-sm font-semibold text-slate-900">Top Recurring Issues</h2>
                                                        <span className="text-xs text-slate-400">({filteredIssues.length} shown)</span>

                                                        {/* Category filter */}
                                                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                                                            <button
                                                                onClick={() => setExpandAll((v) => !v)}
                                                                className="text-xs text-indigo-600 hover:underline font-medium"
                                                            >
                                                                {expandAll ? "Collapse all" : "Expand all"}
                                                            </button>
                                                            <select
                                                                value={categoryFilter}
                                                                onChange={(e) => setCategoryFilter(e.target.value)}
                                                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            >
                                                                <option value="all">All categories</option>
                                                                {categories.map((c) => (
                                                                    <option key={c} value={c}>{c}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 space-y-2">
                                                        {filteredIssues.length === 0 ? (
                                                            <p className="text-sm text-slate-400 text-center py-8">No issues found for this category.</p>
                                                        ) : (
                                                            filteredIssues.map((issue, i) => (
                                                                <IssueCard
                                                                    key={i}
                                                                    issue={issue}
                                                                    rank={i + 1}
                                                                    maxCount={maxCount}
                                                                />
                                                            ))
                                                        )}
                                                    </div>

                                                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                                                        <p className="text-xs text-slate-400">
                                                            Patterns extracted from Maia knowledge base ·{" "}
                                                            Generated {new Date(errorPatterns.generated_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}