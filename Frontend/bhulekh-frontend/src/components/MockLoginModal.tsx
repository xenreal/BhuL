import React, { useState } from "react"
import { ShieldCheck, UserCheck, X, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface UserProfile {
  name: string
  role: "Patwari" | "Tehsildar" | "Admin"
  district: string
  badgeId: string
}

interface MockLoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (user: UserProfile) => void
}

export const MockLoginModal: React.FC<MockLoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [officerName, setOfficerName] = useState("Rajesh Sharma")
  const [officerRole, setOfficerRole] = useState<"Patwari" | "Tehsildar">("Patwari")
  const [district, setDistrict] = useState("Mandi (HP)")
  const [badgeId, setBadgeId] = useState("REV-2026-884")

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin({
      name: officerName || "Revenue Officer",
      role: officerRole,
      district: district || "North Central",
      badgeId: badgeId || "REV-2026-001",
    })
    onClose()
  }

  const handleQuickLogin = (role: "Patwari" | "Tehsildar") => {
    onLogin({
      name: role === "Patwari" ? "Rajesh Sharma (Patwari)" : "S. K. Verma (Tehsildar)",
      role,
      district: "Mandi / Bathinda Division",
      badgeId: role === "Patwari" ? "PAT-HP-1042" : "TEH-PB-8891",
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100/70 text-[#9b673c]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Department Officer Sign In
            </h3>
            <p className="text-xs text-slate-500">
              National Land Records Modernization Portal
            </p>
          </div>
        </div>

        {/* Quick Demo Logins */}
        <div className="my-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quick 1-Click Demo Profiles
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("Patwari")}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-[#9b673c]/50 hover:bg-amber-50/50 hover:text-[#9b673c] transition"
            >
              <UserCheck className="h-4 w-4" />
              Patwari Login
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("Tehsildar")}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-[#9b673c]/50 hover:bg-amber-50/50 hover:text-[#9b673c] transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Tehsildar Login
            </button>
          </div>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Or custom officer credentials
          </span>
        </div>

        {/* Custom Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Officer Full Name
            </label>
            <Input
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Department Role
              </label>
              <select
                value={officerRole}
                onChange={(e) => setOfficerRole(e.target.value as any)}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-[#9b673c]"
              >
                <option value="Patwari">Patwari (Revenue Clerk)</option>
                <option value="Tehsildar">Tehsildar (Executive)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Revenue Circle / District
              </label>
              <Input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Mandi / Deon"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Badge / Service Token ID
            </label>
            <Input
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              placeholder="e.g. REV-2026-884"
              required
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full bg-[#9b673c] hover:bg-[#85552f] text-white font-medium py-2.5 shadow-sm"
            >
              <Lock className="mr-1.5 h-4 w-4" />
              Authorize & Unlock Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

