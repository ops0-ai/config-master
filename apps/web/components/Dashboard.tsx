'use client';

import { useState, useEffect } from 'react';
import { 
  ServerIcon, 
  KeyIcon, 
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalServers: number;
  onlineServers: number;
  totalConfigurations: number;
  activeDrifts: number;
  recentDeployments: number;
  pemKeys: number;
}

interface RecentActivity {
  id: string;
  type: 'deployment' | 'drift' | 'server_added' | 'configuration_created';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalServers: 0,
    onlineServers: 0,
    totalConfigurations: 0,
    activeDrifts: 0,
    recentDeployments: 0,
    pemKeys: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for demonstration
    setTimeout(() => {
      setStats({
        totalServers: 24,
        onlineServers: 22,
        totalConfigurations: 48,
        activeDrifts: 3,
        recentDeployments: 12,
        pemKeys: 8,
      });

      setRecentActivity([
        {
          id: '1',
          type: 'deployment',
          description: 'Deployed NGINX configuration to web-server-01',
          timestamp: '2 minutes ago',
          status: 'success',
        },
        {
          id: '2',
          type: 'drift',
          description: 'Configuration drift detected on db-server-03',
          timestamp: '15 minutes ago',
          status: 'warning',
        },
        {
          id: '3',
          type: 'server_added',
          description: 'New server api-server-05 added to production group',
          timestamp: '1 hour ago',
          status: 'info',
        },
        {
          id: '4',
          type: 'configuration_created',
          description: 'Created new Docker configuration template',
          timestamp: '2 hours ago',
          status: 'success',
        },
        {
          id: '5',
          type: 'deployment',
          description: 'Failed to deploy security patches to app-server-02',
          timestamp: '3 hours ago',
          status: 'error',
        },
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const statCards = [
    {
      title: 'Total Servers',
      value: stats.totalServers,
      change: '+2 from last week',
      changeType: 'positive',
      icon: ServerIcon,
      color: 'bg-blue-500',
    },
    {
      title: 'Online Servers',
      value: stats.onlineServers,
      change: `${Math.round((stats.onlineServers / stats.totalServers) * 100)}% uptime`,
      changeType: 'positive',
      icon: CheckCircleIcon,
      color: 'bg-green-500',
    },
    {
      title: 'Configurations',
      value: stats.totalConfigurations,
      change: '+8 this month',
      changeType: 'positive',
      icon: CpuChipIcon,
      color: 'bg-purple-500',
    },
    {
      title: 'Active Drifts',
      value: stats.activeDrifts,
      change: '-2 from yesterday',
      changeType: 'positive',
      icon: ExclamationTriangleIcon,
      color: 'bg-orange-500',
    },
    {
      title: 'Recent Deployments',
      value: stats.recentDeployments,
      change: 'Last 24 hours',
      changeType: 'neutral',
      icon: ChartBarIcon,
      color: 'bg-indigo-500',
    },
    {
      title: 'PEM Keys',
      value: stats.pemKeys,
      change: 'Managed securely',
      changeType: 'neutral',
      icon: KeyIcon,
      color: 'bg-teal-500',
    },
  ];

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'deployment':
        return ChartBarIcon;
      case 'drift':
        return ExclamationTriangleIcon;
      case 'server_added':
        return ServerIcon;
      case 'configuration_created':
        return CpuChipIcon;
      default:
        return ClockIcon;
    }
  };

  const getStatusColor = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-orange-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-32">
                <div className="card-content">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted mt-1">
          Overview of your infrastructure configuration management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card animate-in hover:shadow-md transition-shadow">
              <div className="card-content">
                <div className="flex items-center">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className={`text-sm ${
                    stat.changeType === 'positive' ? 'text-green-600' :
                    stat.changeType === 'negative' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-header">Recent Activity</h2>
          </div>
          <div className="card-content p-0">
            <div className="divide-y divide-gray-200">
              {recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="p-4 flex items-start space-x-3">
                    <div className={`${getStatusColor(activity.status)} mt-0.5`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card-footer">
            <button className="btn btn-ghost btn-sm w-full">
              View all activity
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-header">Quick Actions</h2>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 gap-3">
              <button className="btn btn-primary btn-md justify-start">
                <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                Start Configuration Chat
              </button>
              <button className="btn btn-secondary btn-md justify-start">
                <ServerIcon className="h-5 w-5 mr-2" />
                Add New Server
              </button>
              <button className="btn btn-secondary btn-md justify-start">
                <KeyIcon className="h-5 w-5 mr-2" />
                Upload PEM Key
              </button>
              <button className="btn btn-secondary btn-md justify-start">
                <CpuChipIcon className="h-5 w-5 mr-2" />
                Create Configuration
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Health Overview */}
      <div className="mt-8 card">
        <div className="card-header">
          <h2 className="section-header">Infrastructure Health</h2>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.round((stats.onlineServers / stats.totalServers) * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Server Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(((stats.totalConfigurations - stats.activeDrifts) / stats.totalConfigurations) * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Configuration Compliance</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {stats.recentDeployments}
              </div>
              <div className="text-sm text-gray-600 mt-1">Deployments Today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}