'use client';

import { useState, ReactNode } from 'react';
import {
  HomeIcon,
  ServerIcon,
  KeyIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import OrganizationSwitcher from './OrganizationSwitcher';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Configuration Chat', href: '/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Servers', href: '/servers', icon: ServerIcon },
  { name: 'Server Groups', href: '/server-groups', icon: CpuChipIcon },
  { name: 'Configurations', href: '/configurations', icon: CpuChipIcon },
  { name: 'Deployments', href: '/deployments', icon: ChartBarIcon },
  { name: 'MDM', href: '/mdm', icon: DevicePhoneMobileIcon },
  { name: 'Infrastructure Training', href: '/training', icon: AcademicCapIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-gray-50 border-r border-gray-300">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <XMarkIcon className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Desktop header with organization switcher */}
        <div className="hidden lg:flex items-center justify-end bg-white px-6 py-3 shadow-sm border-b border-gray-200">
          <OrganizationSwitcher />
        </div>
        
        <div className="lg:hidden">
          <div className="flex items-center justify-between bg-white px-4 py-2 shadow-sm border-b border-gray-200">
            <button
              type="button"
              className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center">
              <OrganizationSwitcher />
            </div>
          </div>
        </div>

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );

  function SidebarContent() {
    const { user } = useMinimalAuth();
    
    return (
      <>
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-50 border-b border-gray-300">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Pulse Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900">Pulse</h1>
              <p className="text-xs text-gray-600">Enterprise Config Management</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50 border-r border-gray-300">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
            
            {/* Global Admin Section - Only visible to super admins */}
            {user?.isSuperAdmin && (
              <>
                <div className="pt-4 mt-4 border-t border-gray-300">
                  <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Global Admin
                  </h3>
                </div>
                <Link
                  href="/admin/organizations"
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === '/admin/organizations'
                      ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <ShieldCheckIcon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      pathname === '/admin/organizations' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  Organization Management
                </Link>
              </>
            )}
          </nav>

          <div className="flex-shrink-0 p-4 border-t border-gray-300 bg-gray-100">
            <UserProfile />
          </div>
        </div>
      </>
    );
  }

  function UserProfile() {
    const { user, organization, logout } = useMinimalAuth();
    const [showDropdown, setShowDropdown] = useState(false);

    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center w-full p-2 rounded-lg hover:bg-white hover:shadow-sm transition-colors"
        >
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-primary-600" />
          </div>
          <div className="ml-3 text-left">
            <p className="text-sm font-medium text-gray-700">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500">{organization?.name || 'Organization'}</p>
          </div>
        </button>

        {showDropdown && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="p-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="p-2">
              <Link
                href="/settings"
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                onClick={() => setShowDropdown(false)}
              >
                <Cog6ToothIcon className="w-4 h-4 inline mr-2" />
                Settings
              </Link>
              <button
                onClick={() => {
                  logout();
                  setShowDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 inline mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}