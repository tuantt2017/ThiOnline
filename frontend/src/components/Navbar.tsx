'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  GraduationCap,
  LogOut,
  Shield,
  BookOpen,
  FolderTree,
  Network,
  LayoutDashboard,
  HelpCircle,
  FileCheck2,
  ClipboardList,
  Menu,
  X,
  Sparkles,
  Settings,
  ChevronDown,
  Layers,
  Compass,
  Users,
} from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((res) => setIsBackendHealthy(res.status === 'healthy'))
      .catch(() => setIsBackendHealthy(false));
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMoreMenuOpen(false);
  }, [pathname]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 border border-purple-200">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
            <BookOpen className="w-3 h-3" /> Giáo viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 border border-blue-200">
            <GraduationCap className="w-3 h-3" /> Học sinh
          </span>
        );
    }
  };

  // Optimized Master List of Navigation Links with strict priority grouping
  const allNavLinks = [
    {
      label: 'Giám sát học sinh AI',
      href: '/teacher/analytics',
      icon: Users,
      visible: user?.role === 'TEACHER' || user?.role === 'ADMIN',
      priority: true, // Primary Top Bar
    },
    {
      label: 'Trợ Lý AI 1-on-1',
      href: '/study-companion',
      icon: Sparkles,
      visible: !!user,
      priority: true, // Primary Top Bar
    },
    {
      label: 'Tài liệu SGK',
      href: '/documents',
      icon: FolderTree,
      visible: !!user,
      priority: true, // Primary Top Bar
    },
    {
      label: 'Quản lý Đề thi',
      href: '/exams',
      icon: FileCheck2,
      visible: user?.role === 'TEACHER' || user?.role === 'ADMIN',
      priority: true, // Primary Top Bar
    },
    {
      label: 'Đề thi của tôi',
      href: '/student/exams',
      icon: ClipboardList,
      visible: user?.role === 'STUDENT',
      priority: true, // Primary Top Bar
    },
    {
      label: 'Bản đồ Tri thức',
      href: '/knowledge-map',
      icon: Network,
      visible: true,
      priority: false, // "Mở rộng" Dropdown
    },
    {
      label: 'Lộ Trình Học Tập AI',
      href: '/learning-roadmap',
      icon: Compass,
      visible: !!user,
      priority: false, // "Mở rộng" Dropdown
    },
    {
      label: 'Ngân hàng câu hỏi',
      href: '/questions',
      icon: HelpCircle,
      visible: !!user,
      priority: false, // "Mở rộng" Dropdown
    },
  ];


  const visibleLinks = allNavLinks.filter((l) => l.visible);
  const primaryLinks = visibleLinks.filter((l) => l.priority);
  const secondaryLinks = visibleLinks.filter((l) => !l.priority);

  const isSecondaryActive = secondaryLinks.some(
    (link) => pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href + '/'))
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-all shadow-sm">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left Section: Brand Logo & Desktop Navigation */}
        <div className="flex items-center gap-3 xl:gap-5 min-w-0">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                Online Exam <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
              </span>
              <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
                Khảo Thí Smart AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (Primary Top Bar) */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href + '/'));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs xl:text-sm font-bold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* "Mở rộng" Dropdown Menu for Scalable Features */}
            {secondaryLinks.length > 0 && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs xl:text-sm font-bold whitespace-nowrap transition ${
                    isSecondaryActive || isMoreMenuOpen
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0 text-indigo-600" />
                  <span>Mở rộng</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Panel */}
                {isMoreMenuOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-200/90 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Chức năng mở rộng
                    </div>
                    {secondaryLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href + '/'));
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-extrabold'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-indigo-600" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Right Section: User Profile & Controls */}
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          
          {/* Compact Backend Health Indicator */}
          <div
            className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 shrink-0"
            title={isBackendHealthy ? 'Máy chủ Backend đang hoạt động tốt' : 'Không thể kết nối máy chủ Backend'}
          >
            <span className="flex h-2 w-2 relative shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isBackendHealthy === true
                    ? 'bg-emerald-400'
                    : isBackendHealthy === false
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isBackendHealthy === true
                    ? 'bg-emerald-500'
                    : isBackendHealthy === false
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
              {isBackendHealthy === true ? 'Backend' : 'Mất kết nối'}
            </span>
          </div>

          {/* Desktop Auth Controls */}
          {user ? (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Link
                href={user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/student'}
                className="flex items-center gap-2 px-2.5 xl:px-3 py-1.5 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition shadow-sm bg-white"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-extrabold text-slate-900 text-xs truncate max-w-[100px] xl:max-w-[130px]">
                    {user.full_name}
                  </span>
                  {getRoleBadge(user.role)}
                </div>
              </Link>
              <Link
                href="/settings"
                title="Cài đặt & Đổi mật khẩu"
                className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-600 transition bg-white shadow-sm shrink-0"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 transition bg-white shadow-sm shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Link
                href="/login"
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
              >
                Đăng ký
              </Link>
            </div>
          )}

          {/* Mobile / Tablet Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer Menu with Scroll Container */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          {/* User Profile Card on Mobile */}
          {user && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/80 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{user.full_name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
              </div>
              <div>{getRoleBadge(user.role)}</div>
            </div>
          )}

          {/* Navigation Links List */}
          <div className="flex flex-col space-y-1">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href + '/'));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 text-blue-600" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <>
                <Link
                  href="/settings"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-200 transition"
                >
                  <Settings className="w-4 h-4" /> Cài đặt & Đổi mật khẩu
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-bold text-sm border border-rose-200 hover:bg-rose-100 transition"
                >
                  <LogOut className="w-4 h-4" /> Đăng xuất tài khoản
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/login"
                  className="flex items-center justify-center py-2.5 px-4 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm hover:bg-slate-50 transition text-center"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition text-center shadow-sm"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
