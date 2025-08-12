'use client';

import { useState, useEffect, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BuildingOfficeIcon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import { organizationApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  role?: string;
}

export default function OrganizationSwitcher() {
  const { organization, setOrganization } = useMinimalAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getUserOrganizations();
      setOrganizations(response.data);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchOrganization = async (org: Organization) => {
    if (org.id === organization?.id) return;

    try {
      setSwitching(true);
      const response = await organizationApi.switchOrganization(org.id);
      
      // Update the context with the organization data returned from the API
      const updatedOrganization = response.data.organization;
      const newToken = response.data.token;
      
      // Update localStorage with new token and organization
      localStorage.setItem('authToken', newToken);
      
      setOrganization({
        id: updatedOrganization.id,
        name: updatedOrganization.name,
      });
      
      toast.success(`Switched to ${updatedOrganization.name}`);
      
      // Reload the page to refresh all data for the new organization
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to switch organization');
    } finally {
      setSwitching(false);
    }
  };

  if (!organization) return null;

  return (
    <Menu as="div" className="relative">
      <Menu.Button 
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        disabled={switching}
      >
        <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />
        <span className="max-w-[150px] truncate">{organization.name}</span>
        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Organizations
            </p>
          </div>
          
          <div className="py-1 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                Loading organizations...
              </div>
            ) : organizations.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                No organizations found
              </div>
            ) : (
              organizations.map((org) => (
                <Menu.Item key={org.id}>
                  {({ active }) => (
                    <button
                      onClick={() => handleSwitchOrganization(org)}
                      className={`
                        ${active ? 'bg-gray-100' : ''}
                        ${org.id === organization.id ? 'bg-indigo-50' : ''}
                        group flex w-full items-center justify-between px-4 py-2 text-sm
                      `}
                      disabled={switching}
                    >
                      <div className="flex items-center gap-3">
                        <BuildingOfficeIcon 
                          className={`h-5 w-5 ${
                            org.id === organization.id ? 'text-indigo-600' : 'text-gray-400'
                          }`}
                        />
                        <div className="text-left">
                          <p className={`font-medium ${
                            org.id === organization.id ? 'text-indigo-900' : 'text-gray-900'
                          }`}>
                            {org.name}
                          </p>
                          {org.role && (
                            <p className="text-xs text-gray-500 capitalize">
                              {org.role}
                            </p>
                          )}
                        </div>
                      </div>
                      {org.id === organization.id && (
                        <CheckIcon className="h-5 w-5 text-indigo-600" />
                      )}
                    </button>
                  )}
                </Menu.Item>
              ))
            )}
          </div>

          <div className="border-t border-gray-200">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => {
                    toast('Create organization feature coming soon!', {
                      icon: '🚧',
                    });
                  }}
                  className={`
                    ${active ? 'bg-gray-100' : ''}
                    group flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700
                  `}
                >
                  <PlusIcon className="h-5 w-5 text-gray-400" />
                  <span>Create New Organization</span>
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}