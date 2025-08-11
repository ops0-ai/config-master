'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ServerIcon, 
  KeyIcon, 
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { dashboardApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalServers: number;
  onlineServers: number;
  totalConfigurations: number;
  approvedConfigurations: number;
  activeDrifts: number;
  recentDeployments: number;
  pemKeys: number;
  conversations: {
    total: number;
    active: number;
    generatedConfigs: number;
  };
  infrastructure: {
    serverUptime: number;
    configurationCompliance: number;
    deploymentSuccessRate: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'deployment' | 'drift' | 'server_added' | 'configuration_created' | 'conversation';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

interface InfrastructureHealth {
  servers: Record<string, number>;
  deployments: Record<string, number>;
  configurations: Record<string, number>;
  drift: Record<string, number>;
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalServers: 0,
    onlineServers: 0,
    totalConfigurations: 0,
    approvedConfigurations: 0,
    activeDrifts: 0,
    recentDeployments: 0,
    pemKeys: 0,
    conversations: {
      total: 0,
      active: 0,
      generatedConfigs: 0
    },
    infrastructure: {
      serverUptime: 0,
      configurationCompliance: 0,
      deploymentSuccessRate: 0
    }
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [healthData, setHealthData] = useState<InfrastructureHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const statsResponse = await dashboardApi.getStats();
      setStats(statsResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activityResponse = await dashboardApi.getActivity(8);
      const activities = activityResponse.data.map((activity: any) => ({
        ...activity,
        timestamp: formatTimestamp(activity.timestamp)
      }));
      setRecentActivity(activities);
      setActivityLoading(false);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
      setActivityLoading(false);
    }
  };

  const loadHealthData = async () => {
    try {
      const healthResponse = await dashboardApi.getHealth();
      setHealthData(healthResponse.data);
    } catch (error) {
      console.error('Failed to load health data:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    loadDashboardData();
    loadRecentActivity();
    loadHealthData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData();
      loadRecentActivity();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Servers',
      value: stats.totalServers,
      change: `${stats.onlineServers} online`,
      changeType: stats.onlineServers === stats.totalServers ? 'positive' : 'neutral',
      icon: ServerIcon,
      color: 'bg-blue-500',
    },
    {
      title: 'Online Servers',
      value: stats.onlineServers,
      change: stats.totalServers > 0 
        ? `${Math.round((stats.onlineServers / stats.totalServers) * 100)}% uptime`
        : 'No servers',
      changeType: stats.totalServers > 0 && stats.onlineServers === stats.totalServers ? 'positive' : 'neutral',
      icon: CheckCircleIcon,
      color: 'bg-green-500',
    },
    {
      title: 'Configurations',
      value: stats.totalConfigurations,
      change: `${stats.approvedConfigurations} approved`,
      changeType: 'neutral',
      icon: CpuChipIcon,
      color: 'bg-purple-500',
    },
    {
      title: 'Active Drifts',
      value: stats.activeDrifts,
      change: stats.activeDrifts === 0 ? 'All compliant' : 'Needs attention',
      changeType: stats.activeDrifts === 0 ? 'positive' : 'negative',
      icon: ExclamationTriangleIcon,
      color: stats.activeDrifts === 0 ? 'bg-green-500' : 'bg-orange-500',
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
    {
      title: 'Conversations',
      value: stats.conversations.total,
      change: `${stats.conversations.active} active`,
      changeType: 'neutral',
      icon: UserGroupIcon,
      color: 'bg-cyan-500',
    },
    {
      title: 'Generated Configs',
      value: stats.conversations.generatedConfigs,
      change: 'Created via AI chat',
      changeType: 'neutral',
      icon: DocumentTextIcon,
      color: 'bg-pink-500',
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
      case 'conversation':
        return ChatBubbleLeftRightIcon;
      default:
        return ClockIcon;
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'chat':
        router.push('/chat');
        break;
      case 'server':
        router.push('/servers');
        break;
      case 'pem-key':
        router.push('/pem-keys');
        break;
      case 'configuration':
        router.push('/configurations');
        break;
      default:
        break;
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card h-32">
                <div className="card-content">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card h-96">
              <div className="card-content">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}\n                </div>
              </div>
            </div>
            <div className="card h-96">
              <div className="card-content">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
            {activityLoading ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-3 animate-pulse">
                    <div className="w-5 h-5 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {recentActivity.length === 0 ? (
                  <div className="p-8 text-center">
                    <ClockIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No recent activity</p>
                  </div>
                ) : (
                  recentActivity.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="p-4 flex items-start space-x-3 hover:bg-gray-50 transition-colors">
                        <div className={`${getStatusColor(activity.status)} mt-0.5 p-1 rounded-full bg-opacity-10`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            activity.status === 'success' ? 'bg-green-100 text-green-800' :
                            activity.status === 'error' ? 'bg-red-100 text-red-800' :
                            activity.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div className="card-footer">
            <button 
              onClick={() => router.push('/settings/audit-logs')}
              className="btn btn-ghost btn-sm w-full"
            >
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
              <button 
                onClick={() => handleQuickAction('chat')}
                className="btn btn-primary btn-md justify-start"
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                Start Configuration Chat
              </button>
              <button 
                onClick={() => handleQuickAction('server')}
                className="btn btn-secondary btn-md justify-start"
              >
                <ServerIcon className="h-5 w-5 mr-2" />
                Add New Server
              </button>
              <button 
                onClick={() => handleQuickAction('pem-key')}
                className="btn btn-secondary btn-md justify-start"
              >
                <KeyIcon className="h-5 w-5 mr-2" />
                Upload PEM Key
              </button>
              <button 
                onClick={() => handleQuickAction('configuration')}
                className="btn btn-secondary btn-md justify-start"
              >
                <CpuChipIcon className="h-5 w-5 mr-2" />
                Create Configuration
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Health Overview */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card">
            <div className="card-header">
              <h2 className="section-header">Infrastructure Health</h2>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    stats.infrastructure.serverUptime >= 95 ? 'text-green-600' :
                    stats.infrastructure.serverUptime >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.infrastructure.serverUptime}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Server Uptime</div>
                  <div className="text-xs text-gray-500">
                    {stats.onlineServers}/{stats.totalServers} servers online
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    stats.infrastructure.configurationCompliance >= 95 ? 'text-green-600' :
                    stats.infrastructure.configurationCompliance >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.infrastructure.configurationCompliance}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Config Compliance</div>
                  <div className="text-xs text-gray-500">
                    {stats.activeDrifts} active drifts
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    stats.infrastructure.deploymentSuccessRate >= 95 ? 'text-green-600' :
                    stats.infrastructure.deploymentSuccessRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.infrastructure.deploymentSuccessRate}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Deploy Success</div>
                  <div className="text-xs text-gray-500">Last 30 days</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.recentDeployments}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Deployments</div>
                  <div className="text-xs text-gray-500">Last 24 hours</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="section-header">System Overview</h2>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <ServerIcon className="h-5 w-5 text-blue-500 mr-3" />
                    <span className="text-sm font-medium">Managed Servers</span>
                  </div>
                  <span className="text-lg font-semibold">{stats.totalServers}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <CpuChipIcon className="h-5 w-5 text-purple-500 mr-3" />
                    <span className="text-sm font-medium">Configurations</span>
                  </div>
                  <span className="text-lg font-semibold">{stats.totalConfigurations}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-cyan-500 mr-3" />
                    <span className="text-sm font-medium">AI Conversations</span>
                  </div>
                  <span className="text-lg font-semibold">{stats.conversations.total}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <KeyIcon className="h-5 w-5 text-teal-500 mr-3" />
                    <span className="text-sm font-medium">Security Keys</span>
                  </div>
                  <span className="text-lg font-semibold">{stats.pemKeys}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}