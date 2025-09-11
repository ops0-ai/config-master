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
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  MagnifyingGlassCircleIcon,
  WrenchScrewdriverIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import { useOrganizationFeatures, OrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';
import OrganizationSwitcher from './OrganizationSwitcher';
import Onboarding from './Onboarding';
import AIAssistant from './AIAssistant';

interface LayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  feature: keyof OrganizationFeatures | null;
  beta?: boolean;
  comingSoon?: boolean;
}

interface NavigationGroup {
  name: string;
  items: NavigationItem[];
}

// Global navigation items (no group)
const globalNavigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, feature: null },
  { name: 'Phoenix - AI DevOps Engineer', href: '/chat', icon: ChatBubbleLeftRightIcon, feature: 'chat' as keyof OrganizationFeatures },
];

// Grouped navigation items
const navigationGroups: NavigationGroup[] = [
  {
    name: 'Create',
    items: [
      { name: 'IaC', href: '/iac', icon: CodeBracketIcon, feature: null, comingSoon: true },
      { name: 'Discovery', href: '/discovery', icon: MagnifyingGlassCircleIcon, feature: null, comingSoon: true },
    ]
  },
  {
    name: 'Manage',
    items: [
      { name: 'Configurations', href: '/configurations', icon: CpuChipIcon, feature: 'configurations' as keyof OrganizationFeatures },
      { name: 'Deployments', href: '/deployments', icon: ChartBarIcon, feature: 'deployments' as keyof OrganizationFeatures },
      { name: 'Assets', href: '/assets', icon: ComputerDesktopIcon, feature: 'assets' as keyof OrganizationFeatures },
      { name: 'MDM', href: '/mdm', icon: DevicePhoneMobileIcon, feature: 'mdm' as keyof OrganizationFeatures },
    ]
  },
  {
    name: 'Operate',
    items: [
      { name: 'Hive Monitoring', href: '/hive', icon: EyeIcon, feature: 'hive' as keyof OrganizationFeatures, beta: true },
    ]
  },
  {
    name: 'Resources',
    items: [
      { name: 'Servers', href: '/servers', icon: ServerIcon, feature: 'servers' as keyof OrganizationFeatures },
      { name: 'Server Groups', href: '/server-groups', icon: BuildingOfficeIcon, feature: 'serverGroups' as keyof OrganizationFeatures },
    ]
  }
];

// Settings and utility items
const utilityNavigation: NavigationItem[] = [
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, feature: null },
  { name: 'Infrastructure Training', href: '/training', icon: AcademicCapIcon, feature: 'training' as keyof OrganizationFeatures },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<{[key: string]: boolean}>({});
  const pathname = usePathname();
  const { user } = useMinimalAuth();
  const { isFeatureEnabled, loading: featuresLoading } = useOrganizationFeatures();
  
  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

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
    <div className="h-screen max-h-screen flex overflow-hidden bg-gray-100">
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
        <div className={`flex flex-col h-full max-h-screen transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <SidebarContent />
        </div>
      </div>

      {/* Main content - Full width without header */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between bg-white px-4 py-2 shadow-sm border-b border-gray-200">
            <button
              type="button"
              className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <main className="flex-1 relative overflow-hidden focus:outline-none bg-gray-50">
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

      {/* AI Assistant - Available on all pages */}
      <AIAssistant />
    </div>
  );

  function SidebarContent() {
    const { user } = useMinimalAuth();
    
    return (
      <>
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-300">
          {sidebarCollapsed ? (
            /* Collapsed Header - Logo only with expand button positioned to the right */
            <div className="relative h-16 flex items-center justify-center">
              <div className="flex-shrink-0">
                <Image
                  src="/images/logo-side-new.svg"
                  alt="Pulse Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              {/* Expand button positioned to the right of the collapsed sidebar */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute -right-3 top-1/2 transform -translate-y-1/2 p-1 bg-white border border-gray-300 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-sm z-10"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Expanded Header - Logo with text and collapse button */
            <>
              <div className="flex items-center justify-between h-16 px-4">
                <div className="flex items-center overflow-hidden">
                  <div className="flex-shrink-0">
                    <Image
                      src="/images/logo-side-new.svg"
                      alt="Pulse Logo"
                      width={32}
                      height={32}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="ml-3 overflow-hidden">
                    <h1 className="text-lg font-semibold text-gray-900">Pulse</h1>
                    <p className="text-xs text-gray-600 whitespace-nowrap">AI DevOps Platform</p>
                  </div>
                </div>
                {/* Collapse Toggle Button */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-white transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
              </div>
              {/* Organization Switcher moved here */}
              <div className="px-4 pb-3">
                <OrganizationSwitcher />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col h-full max-h-screen bg-gray-50 border-r border-gray-300">
          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 min-h-0" style={{maxHeight: 'calc(100vh - 100px)'}}>
            {/* Global Navigation Items */}
            {globalNavigation.filter((item) => {
              if (!item.feature) return true;
              if (user?.isSuperAdmin) return true;
              return isFeatureEnabled(item.feature);
            }).map((item) => {
              const isActive = pathname === item.href;
              const isDisabled = item.feature && !isFeatureEnabled(item.feature) && !user?.isSuperAdmin;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    sidebarCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  } ${
                    isDisabled ? 'text-gray-400 cursor-not-allowed opacity-50' : ''
                  }`}
                  title={sidebarCollapsed ? item.name : ''}
                >
                  <item.icon
                    className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0 ${
                      isActive ? 'text-primary-600' : isDisabled ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="flex items-center justify-between w-full">
                      <span>{item.name}</span>
                    </span>
                  )}
                </Link>
              );
            })}
            
            {/* Grouped Navigation Items */}
            {navigationGroups.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.name];
              const filteredItems = group.items.filter((item) => {
                if (!item.feature) return true;
                if (user?.isSuperAdmin) return true;
                return isFeatureEnabled(item.feature);
              });
              
              return (
                <div key={group.name} className="pt-4">
                  {!sidebarCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-700 transition-colors"
                    >
                      <span>{group.name}</span>
                      <ChevronRightIcon className={`h-3 w-3 transition-transform ${
                        isGroupCollapsed ? '' : 'rotate-90'
                      }`} />
                    </button>
                  ) : (
                    <div className="px-2 mb-2">
                      <div className="h-px bg-gray-300"></div>
                    </div>
                  )}
                  
                  {(!isGroupCollapsed || sidebarCollapsed) && (
                    <div className="space-y-1">
                      {filteredItems.map((item) => {
                        const isActive = pathname === item.href;
                        const isDisabled = item.feature && !isFeatureEnabled(item.feature) && !user?.isSuperAdmin;
                        
                        if (item.comingSoon) {
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                                sidebarCollapsed ? 'justify-center' : ''
                              } ${
                                isActive
                                  ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                                  : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                              }`}
                              title={sidebarCollapsed ? `${item.name} - Coming Soon` : ''}
                            >
                              <item.icon
                                className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0 ${
                                  isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                                }`}
                              />
                              {!sidebarCollapsed && (
                                <span className="flex items-center justify-between w-full">
                                  <span>{item.name}</span>
                                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm animate-pulse">
                                    SOON
                                  </span>
                                </span>
                              )}
                            </Link>
                          );
                        }
                        
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                              sidebarCollapsed ? 'justify-center' : ''
                            } ${
                              isActive
                                ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                                : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                            } ${
                              isDisabled ? 'text-gray-400 cursor-not-allowed opacity-50' : ''
                            }`}
                            title={sidebarCollapsed ? item.name : ''}
                          >
                            <item.icon
                              className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0 ${
                                isActive ? 'text-primary-600' : isDisabled ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-500'
                              }`}
                            />
                            {!sidebarCollapsed && (
                              <span className="flex items-center justify-between w-full">
                                <span>{item.name}</span>
                                {item.beta && (
                                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm">
                                    BETA
                                  </span>
                                )}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Global Admin Section - Only visible to super admins */}
            {user?.isSuperAdmin && (
              <div className="pt-4">
                {!sidebarCollapsed && (
                  <div className="border-t border-gray-300 pt-4">
                    <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Global Admin
                    </h3>
                  </div>
                )}
                <Link
                  href="/admin/organizations"
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    sidebarCollapsed ? 'justify-center' : ''
                  } ${
                    pathname === '/admin/organizations'
                      ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                      : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  }`}
                  title={sidebarCollapsed ? 'Organization Management' : ''}
                >
                  <ShieldCheckIcon
                    className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0 ${
                      pathname === '/admin/organizations' ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {!sidebarCollapsed && 'Organization Management'}
                </Link>
              </div>
            )}
            
            {/* Settings and other navigation items - Now part of scrollable area */}
            <div className="pt-4">
              {!sidebarCollapsed && (
                <div className="border-t border-gray-300 pt-4 mb-2"></div>
              )}
              
              {/* Settings */}
              <Link
                href="/settings"
                className={`group flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-colors ${
                  sidebarCollapsed ? 'justify-center' : ''
                } ${
                  pathname === '/settings'
                    ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                    : ''
                }`}
                title={sidebarCollapsed ? 'Settings' : ''}
              >
                <Cog6ToothIcon className={`h-5 w-5 ${
                  pathname === '/settings' ? 'text-primary-600' : 'text-gray-400'
                } ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
                {!sidebarCollapsed && <span>Settings</span>}
              </Link>
              
              {/* Tutorials & Help Button */}
              <button
                onClick={() => setShowOnboarding(true)}
                className={`group w-full flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-colors ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
                title={sidebarCollapsed ? 'Tutorials & Help' : ''}
              >
                <QuestionMarkCircleIcon className={`h-5 w-5 text-gray-400 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
                {!sidebarCollapsed && <span>Tutorials & Help</span>}
              </button>
              
              {/* Infrastructure Training */}
              {utilityNavigation.filter((item) => {
                if (!item.feature) return true;
                if (user?.isSuperAdmin) return true;
                return isFeatureEnabled(item.feature);
              }).filter((item) => item.name === 'Infrastructure Training').map((item) => {
                const isActive = pathname === item.href;
                const isDisabled = item.feature && !isFeatureEnabled(item.feature) && !user?.isSuperAdmin;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      sidebarCollapsed ? 'justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-white text-primary-900 border-r-2 border-primary-600 shadow-sm'
                        : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                    } ${
                      isDisabled ? 'text-gray-400 cursor-not-allowed opacity-50' : ''
                    }`}
                    title={sidebarCollapsed ? item.name : ''}
                  >
                    <item.icon
                      className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0 ${
                        isActive ? 'text-primary-600' : isDisabled ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
              
              {/* Add some padding at the bottom of scrollable area */}
              <div className="h-4"></div>
            </div>
          </nav>
          
          {/* User Profile Fixed at Bottom */}
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
          className={`flex items-center w-full p-2 rounded-lg hover:bg-white hover:shadow-sm transition-colors ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title={sidebarCollapsed ? user?.name || 'User Profile' : ''}
        >
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-5 h-5 text-primary-600" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3 text-left overflow-hidden">
              <p className="text-sm font-medium text-gray-700 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{organization?.name || 'Organization'}</p>
            </div>
          )}
        </button>

        {showDropdown && (
          <div className={`absolute bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
            sidebarCollapsed 
              ? 'left-full ml-2 w-64' 
              : 'left-0 right-0'
          }`}>
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