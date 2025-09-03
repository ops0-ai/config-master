'use client';

import { useState, ReactNode, useEffect } from 'react';
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
  ComputerDesktopIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import { useOrganizationFeatures, OrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';
import OrganizationSwitcher from './OrganizationSwitcher';
import TutorialButton from './TutorialButton';
import Onboarding from './Onboarding';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, feature: null },
  { name: 'Configuration Chat', href: '/chat', icon: ChatBubbleLeftRightIcon, feature: 'chat' as keyof OrganizationFeatures },
  { name: 'Servers', href: '/servers', icon: ServerIcon, feature: 'servers' as keyof OrganizationFeatures },
  { name: 'Server Groups', href: '/server-groups', icon: CpuChipIcon, feature: 'serverGroups' as keyof OrganizationFeatures },
  { name: 'Configurations', href: '/configurations', icon: CpuChipIcon, feature: 'configurations' as keyof OrganizationFeatures },
  { name: 'Deployments', href: '/deployments', icon: ChartBarIcon, feature: 'deployments' as keyof OrganizationFeatures },
  { name: 'Assets', href: '/assets', icon: ComputerDesktopIcon, feature: 'assets' as keyof OrganizationFeatures },
  { name: 'MDM', href: '/mdm', icon: DevicePhoneMobileIcon, feature: 'mdm' as keyof OrganizationFeatures },
  { name: 'Infrastructure Training', href: '/training', icon: AcademicCapIcon, feature: 'training' as keyof OrganizationFeatures },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, feature: null },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const pathname = usePathname();
  const { user } = useMinimalAuth();
  const { isFeatureEnabled, loading: featuresLoading } = useOrganizationFeatures();

  // Check if user needs onboarding - trigger when user changes
  useEffect(() => {
    console.log('🚀 Layout onboarding effect triggered:', { 
      user: user?.email, 
      userExists: !!user,
      sessionOnboarding: sessionStorage.getItem('onboardingShown'),
      sessionOnboardingUser: sessionStorage.getItem('onboardingShownForUser')
    });
    
    const checkOnboardingStatus = async () => {
      if (!user) {
        console.log('❌ No user, skipping onboarding check');
        setIsCheckingOnboarding(false);
        return;
      }

      try {
        // Check if user has completed onboarding from the token (from database)
        const token = localStorage.getItem('authToken');
        if (token) {
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const hasCompletedOnboarding = tokenData.hasCompletedOnboarding;
          
          console.log('🔍 Onboarding check:', {
            email: user?.email,
            hasCompletedOnboarding,
            tokenData: tokenData
          });
          
          // Only show onboarding if user has NEVER completed it (database value is false)
          // AND we haven't shown it for this specific user in this session
          const onboardingShownForUser = sessionStorage.getItem('onboardingShownForUser');
          
          if (hasCompletedOnboarding === false && onboardingShownForUser !== user.email) {
            console.log('✅ Showing onboarding for first-time user:', user?.email);
            setShowOnboarding(true);
            // Mark that we've shown onboarding for this specific user in this session
            sessionStorage.setItem('onboardingShownForUser', user.email);
          } else {
            console.log('❌ Not showing onboarding:', {
              hasCompletedOnboarding,
              userEmail: user?.email,
              alreadyShownForUser: onboardingShownForUser === user.email
            });
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user]); // Run when user changes

  const handleOnboardingComplete = async () => {
    try {
      const response = await fetch('/api/users/onboarding/complete', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setShowOnboarding(false);
        
        // Update the token to reflect onboarding completion
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            const parts = token.split('.');
            const payload = JSON.parse(atob(parts[1]));
            payload.hasCompletedOnboarding = true;
            // Note: In production, you'd get a new token from the server
            // For now, we'll just mark it as completed locally
          } catch (e) {
            console.error('Error updating token:', e);
          }
        }
        
        console.log('Onboarding completed successfully');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
  };

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
        <div className="hidden lg:flex items-center justify-end bg-white px-6 py-3 shadow-sm border-b border-gray-200 space-x-3">
          <TutorialButton onClick={() => setShowOnboarding(true)} />
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
            <div className="flex items-center space-x-3">
              <TutorialButton onClick={() => setShowOnboarding(true)} />
              <OrganizationSwitcher />
            </div>
          </div>
        </div>

        <main className="flex-1 relative overflow-hidden focus:outline-none">
          {children}
        </main>
      </div>

      {/* Onboarding Modal */}
      {!isCheckingOnboarding && (
        <Onboarding
          isOpen={showOnboarding}
          onClose={handleOnboardingClose}
          onComplete={handleOnboardingComplete}
        />
      )}
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
                src="/images/logo-side-new.svg"
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
            {navigation.filter((item) => {
              // Show items without feature requirements (like Dashboard, Settings)
              if (!item.feature) return true;
              // Show all items to super admins (enabled and disabled)
              if (user?.isSuperAdmin) return true;
              // For regular users, only show enabled features
              return isFeatureEnabled(item.feature);
            }).map((item) => {
              const isActive = pathname === item.href;
              const isDisabled = item.feature && !isFeatureEnabled(item.feature) && !user?.isSuperAdmin;
              
              if (isDisabled) {
                // Render disabled navigation item
                return (
                  <div
                    key={item.name}
                    className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed opacity-50"
                    title="This feature is not enabled for your organization"
                  >
                    <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-300" />
                    {item.name}
                  </div>
                );
              }
              
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