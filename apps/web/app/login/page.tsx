'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  EyeIcon,
  EyeSlashIcon,
  ServerIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import { authApi, api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useMinimalAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Check for disabled organization message and SSO errors on component mount
  useEffect(() => {
    const disabledMessage = localStorage.getItem('disabledOrgMessage');
    if (disabledMessage) {
      toast.error(disabledMessage, {
        duration: 8000,
        icon: '🚫',
      });
      localStorage.removeItem('disabledOrgMessage');
    }

    // Check for SSO error
    const error = searchParams.get('error');
    if (error) {
      const errorMessages: Record<string, string> = {
        sso_failed: 'SSO login failed. Please try again.',
        missing_params: 'Invalid SSO response. Please try again.',
        email_not_found: 'No email address found in SSO response.',
        auto_provision_disabled: 'New user registration via SSO is disabled.',
        invalid_state: 'Invalid SSO state. Please try again.',
        provider_not_found: 'SSO provider not found.',
      };
      toast.error(errorMessages[error] || 'SSO login failed');
    }

    // Fetch available SSO providers
    fetchSSOProviders();
  }, [searchParams]);

  const fetchSSOProviders = async () => {
    try {
      const response = await api.get('/sso/login-providers');
      setSsoProviders(response.data);
    } catch (error) {
      console.error('Failed to fetch SSO providers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authApi.login(formData.email, formData.password);
      
      // Use AuthContext login function which handles state and redirect
      login(response.data.token, response.data.user, response.data.organization);
      
      toast.success('Welcome back!');
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.code === 'ORGANIZATION_DISABLED') {
        toast.error(
          'Organization has been disabled. Please contact your global administrator for assistance.',
          {
            duration: 6000,
            icon: '🚫',
          }
        );
      } else if (errorData?.code === 'USER_DISABLED') {
        toast.error(
          'Your account has been disabled. Please contact your administrator.',
          {
            duration: 6000,
            icon: '🚫',
          }
        );
      } else {
        toast.error(errorData?.error || 'Login failed');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/images/opszero-logo.svg"
              alt="OpsZero Logo"
              width={120}
              height={120}
              priority
            />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">
            Welcome to Pulse
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            An ops0 Product
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Centralized platform to manage servers, devices and cloud configurations
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl">
          {/* SSO Login Options */}
          {ssoProviders.length > 0 && (
            <div className="mb-6">
              <div className="space-y-3">
                {ssoProviders.map((provider) => (
                  <a
                    key={provider.id}
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/sso/login/${provider.id}`}
                    className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                  >
                    <KeyIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Continue with {provider.name}
                  </a>
                ))}
              </div>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="admin@company.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input pr-10"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="loading-spinner w-5 h-5 mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">New to Pulse?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/register"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                Create new account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}