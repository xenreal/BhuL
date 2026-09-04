import React, { useState, useEffect } from "react"
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RotateCw,
  X,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getDashboardStats } from "@/lib/api"
import type { DashboardStats } from "@/lib/api"

interface DashboardDrawerProps {
  isOpen: boolean
  onClose: () => void
  refreshTrigger?: number
}

export const DashboardDrawer: React.FC<DashboardDrawerProps> = ({
  isOpen,
  onClose,
  refreshTrigger,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    setError(null)
    try {
      const data = await getDashboardStats()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || "Failed to load live metrics from backend.")
      }
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  // Auto-fetch stats immediately when opened or when refreshTrigger changes
  useEffect(() => {
    if (isOpen) {
      fetchStats()
      // Background auto-refresh polling every 12 seconds while drawer is open
      const interval = setInterval(() => {
        fetchStats(true)
      }, 12000)
      return () => clearInterval(interval)
    }
  }, [isOpen, refreshTrigger])

  if (!isOpen) return null

  return (
    <aside aria-label="Dashboard Metrics" className="w-full border-b border-amber-900/15 bg-gradient-to-b from-[#f7f4ee] to-[#fbf9f5] shadow-inner transition-all duration-300 animate-in slide-in-from-top-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-amber-900/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-[#9b673c] border border-amber-200">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  Dashboard
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Live overview of digitized land records {lastUpdated && `• Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchStats()}
              disabled={loading}
              className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-amber-100/60"
            >
              <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:bg-amber-100/70 hover:text-slate-700 transition"
              aria-label="Close dashboard drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Error message if backend is unreachable */}
        {error && (
          <div className="my-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => fetchStats()} className="font-semibold underline ml-2">
              Try Again
            </button>
          </div>
        )}

        {/* 3 Main Stat Cards (Section 2a Contract) + Quality Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
          
          {/* Card 1: Uploaded Documents */}
          <Card className="border-slate-200/80 bg-white/95 shadow-2xs hover:shadow-xs transition">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Uploaded
                </p>
                <h4 className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {stats ? stats.uploaded_count : "-"}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  All scanned documents
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-[#9b673c] border border-amber-200/60">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Committed to Registry */}
          <Card className="border-emerald-200/80 bg-emerald-50/20 shadow-2xs hover:shadow-xs transition">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Committed
                </p>
                <h4 className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
                  {stats ? stats.committed_count : "-"}
                </h4>
                <p className="text-[10px] text-emerald-600/80 mt-0.5">
                  Approved and saved records
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Pending Verification */}
          <Card className="border-amber-200/80 bg-amber-50/20 shadow-2xs hover:shadow-xs transition">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Pending Review
                </p>
                <h4 className="text-2xl font-extrabold text-amber-800 font-mono mt-1">
                  {stats ? stats.pending_count : "-"}
                </h4>
                <p className="text-[10px] text-amber-700/80 mt-0.5">
                  Awaiting officer review
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100/70 text-amber-800 border border-amber-200">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Accuracy Rate */}
          <Card className="border-slate-200/80 bg-white/95 shadow-2xs hover:shadow-xs transition">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Accuracy Rate
                </p>
                <h4 className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {stats ? `${Math.round(stats.avg_confidence * 100)}%` : "-"}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Average confidence score
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </aside>
  )
}

