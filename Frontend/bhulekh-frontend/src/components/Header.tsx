import React from "react"
import {
  LogIn,
  LogOut,
  UserCheck,
  Landmark,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { UserProfile } from "./MockLoginModal"
import { DashboardDrawer } from "./DashboardDrawer"

interface HeaderProps {
  user: UserProfile | null
  onOpenLogin: () => void
  onLogout: () => void
  isDashboardOpen: boolean
  onToggleDashboard: () => void
  onOpenSearch: () => void
  refreshTrigger?: number
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenLogin,
  onLogout,
  isDashboardOpen,
  onToggleDashboard,
  onOpenSearch,
  refreshTrigger,
}) => {
  const handleDashboardClick = () => {
    if (!user) {
      onOpenLogin()
    } else {
      onToggleDashboard()
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-900/10 bg-[#fcfbf9]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex flex-col md:flex-row min-h-16 md:h-20 max-w-7xl items-stretch md:items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 md:py-0 gap-2.5 md:gap-4">
        
        {/* Top/Left Bar: BhuLekh Logo + Emblem + Mobile Officer status */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-amber-100/60 text-[#9b673c] border border-amber-200/60 shadow-xs shrink-0">
              <Landmark className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#9b673c] font-serif">
                  BhuLekh
                </span>
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-900/60 bg-amber-100/50 px-2 py-0.5 rounded-full border border-amber-200/40">
                  भूलेख Portal
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium hidden lg:block">
                Digital Land Record Digitization & Validation Engine
              </span>
            </div>
          </div>

          {/* Quick Mobile Auth Badge when user is logged in */}
          {user && (
            <div className="flex sm:hidden items-center gap-1.5 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{user.role}</span>
            </div>
          )}
        </div>

        {/* Action Controls:
            - Mobile (< sm, < 640px): Stacks upon each other in 1 column (grid-cols-1)
            - Tablet (sm, 640px-767px): Stacks in 3 equal columns (sm:grid-cols-3)
            - Desktop (md+, >= 768px): Inline horizontal flex row (md:flex)
        */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-row md:items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          
          {/* 1. Universal Search & Records History Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSearch}
            className="w-full md:w-auto h-9 text-xs font-semibold border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs justify-center"
            title="Search land records by Khasra or Name"
          >
            <Search className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
            <span>Search Records</span>
          </Button>
          
          {/* 2. Universal Dashboard Button */}
          <Button
            variant={isDashboardOpen ? "default" : "outline"}
            size="sm"
            onClick={handleDashboardClick}
            className={`w-full md:w-auto h-9 text-xs font-semibold justify-center transition-all ${
              isDashboardOpen
                ? "bg-[#9b673c] hover:bg-[#85552f] text-white shadow-xs"
                : user
                ? "border-amber-900/20 bg-amber-50/50 text-[#9b673c] hover:bg-amber-100/80 hover:text-[#804f29]"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title={user ? "Toggle Dashboard Metrics" : "Sign in to view Dashboard"}
          >
            {user ? (
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400 shrink-0" />
            )}
            <span>Dashboard</span>
            {isDashboardOpen ? (
              <ChevronUp className="ml-1 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70 shrink-0" />
            )}
          </Button>

          {/* 3. User Auth Section (Login / Sign Out) */}
          {user ? (
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {user.role} • {user.district}
                </span>
              </div>

              <Badge variant="confident" className="hidden sm:inline-flex bg-amber-50 text-[#9b673c] border-amber-200 text-xs">
                <UserCheck className="mr-1 h-3 w-3 shrink-0" />
                {user.role}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="w-full sm:w-auto h-9 border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium justify-center"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span>Sign Out ({user.role})</span>
              </Button>
            </div>
          ) : (
            <Button
              onClick={onOpenLogin}
              className="w-full md:w-auto h-9 bg-[#9b673c] hover:bg-[#85552f] text-white shadow-sm px-4 text-xs font-medium justify-center transition"
            >
              <LogIn className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span>Sign In (Mock)</span>
            </Button>
          )}

        </div>

      </div>

      {/* Collapsible Sliding Dashboard Drawer */}
      <DashboardDrawer
        isOpen={isDashboardOpen && !!user}
        onClose={onToggleDashboard}
        refreshTrigger={refreshTrigger}
      />
    </header>
  )
}
