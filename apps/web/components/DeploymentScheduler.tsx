'use client';

import { useState, useEffect } from 'react';
import { 
  CalendarIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface DeploymentSchedulerProps {
  onScheduleChange: (schedule: {
    scheduleType: 'immediate' | 'scheduled' | 'recurring';
    scheduledFor?: string;
    cronExpression?: string;
    timezone?: string;
  }) => void;
  initialSchedule?: {
    scheduleType: 'immediate' | 'scheduled' | 'recurring';
    scheduledFor?: string;
    cronExpression?: string;
    timezone?: string;
  };
}

const commonCronExpressions = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at 6 PM', value: '0 18 * * *' },
  { label: 'Weekly on Sunday at midnight', value: '0 0 * * 0' },
  { label: 'Weekly on Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Monthly on 1st at midnight', value: '0 0 1 * *' },
];

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export default function DeploymentScheduler({ onScheduleChange, initialSchedule }: DeploymentSchedulerProps) {
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled' | 'recurring'>(
    initialSchedule?.scheduleType || 'immediate'
  );
  const [scheduledFor, setScheduledFor] = useState(initialSchedule?.scheduledFor || '');
  const [cronExpression, setCronExpression] = useState(initialSchedule?.cronExpression || '0 0 * * *');
  const [timezone, setTimezone] = useState(initialSchedule?.timezone || 'UTC');
  const [customCron, setCustomCron] = useState(false);

  useEffect(() => {
    onScheduleChange({
      scheduleType,
      scheduledFor: scheduleType === 'scheduled' ? scheduledFor : undefined,
      cronExpression: scheduleType === 'recurring' ? cronExpression : undefined,
      timezone: scheduleType !== 'immediate' ? timezone : undefined,
    });
  }, [scheduleType, scheduledFor, cronExpression, timezone, onScheduleChange]);

  // Get minimum datetime for scheduling (5 minutes from now)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Deployment Schedule
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Immediate */}
          <div 
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              scheduleType === 'immediate' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setScheduleType('immediate')}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${
                scheduleType === 'immediate' ? 'bg-indigo-500' : 'bg-gray-400'
              }`}>
                <ArrowPathIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Run Immediately</h3>
                <p className="text-sm text-gray-500">Deploy right away</p>
              </div>
            </div>
          </div>

          {/* Scheduled */}
          <div 
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              scheduleType === 'scheduled' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setScheduleType('scheduled')}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${
                scheduleType === 'scheduled' ? 'bg-indigo-500' : 'bg-gray-400'
              }`}>
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Schedule Once</h3>
                <p className="text-sm text-gray-500">Run at specific time</p>
              </div>
            </div>
          </div>

          {/* Recurring */}
          <div 
            className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              scheduleType === 'recurring' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setScheduleType('recurring')}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${
                scheduleType === 'recurring' ? 'bg-indigo-500' : 'bg-gray-400'
              }`}>
                <ClockIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Recurring</h3>
                <p className="text-sm text-gray-500">Repeat on schedule</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Options */}
      {scheduleType === 'scheduled' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={getMinDateTime()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Schedule must be at least 5 minutes in the future
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Recurring Options */}
      {scheduleType === 'recurring' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule Pattern
            </label>
            {!customCron ? (
              <div className="space-y-2">
                <select
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {commonCronExpressions.map(expr => (
                    <option key={expr.value} value={expr.value}>
                      {expr.label} ({expr.value})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCustomCron(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Enter custom cron expression
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setCustomCron(false)}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Use preset schedules
                  </button>
                  <a 
                    href="https://crontab.guru/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cron expression help ↗
                  </a>
                </div>
                <p className="text-xs text-gray-500">
                  Format: minute hour day month weekday (e.g., "0 0 * * *" = daily at midnight)
                </p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}