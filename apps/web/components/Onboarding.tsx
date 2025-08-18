'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Settings, 
  Server, 
  Smartphone, 
  Zap, 
  Shield, 
  Users, 
  BarChart3,
  CloudUpload,
  MonitorSpeaker,
  Rocket
} from 'lucide-react';

interface OnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const onboardingSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Pulse',
    subtitle: 'Your complete infrastructure management platform',
    content: (
      <div className="text-center space-y-6">
        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
          <Rocket className="w-12 h-12 text-white" />
        </div>
        <div className="space-y-4">
          <p className="text-lg text-gray-600">
            Pulse is a powerful platform that helps you manage your entire infrastructure from one place.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Server Management</span>
            </div>
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Device Control (MDM)</span>
            </div>
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Auto Deployments</span>
            </div>
            <div className="flex items-center space-x-3 text-left">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Real-time Monitoring</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'how-it-works',
    title: 'How Pulse Works',
    subtitle: 'Understanding the platform architecture',
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <CloudUpload className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Connect</h4>
            <p className="text-sm text-gray-600">
              Add your servers and devices to Pulse using secure SSH keys or MDM enrollment
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
              <Settings className="w-8 h-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Configure</h4>
            <p className="text-sm text-gray-600">
              Create configurations and policies that define how your infrastructure should be managed
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Deploy</h4>
            <p className="text-sm text-gray-600">
              Automatically deploy configurations and monitor your infrastructure in real-time
            </p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <p className="text-sm text-gray-700">
            <strong>Pro Tip:</strong> Start with adding a few test servers to get familiar with the platform before connecting your production infrastructure.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'server-management',
    title: 'Server Management',
    subtitle: 'Manage your servers and deployments',
    content: (
      <div className="space-y-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Server className="w-6 h-6 text-orange-600" />
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">What you can do:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>Add servers via SSH with PEM keys or password authentication</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>Group servers for easier management</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>Create custom configurations using Ansible playbooks</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>Deploy configurations automatically or on-demand</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <span>Monitor deployment status and view logs</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <h5 className="font-medium text-blue-900 mb-2">Getting Started:</h5>
          <p className="text-sm text-blue-700">
            Go to <strong>Servers</strong> → <strong>Add Server</strong> to connect your first server. 
            You'll need either SSH access with a PEM key or username/password credentials.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'mdm-management',
    title: 'Device Management (MDM)',
    subtitle: 'Control and monitor your devices remotely',
    content: (
      <div className="space-y-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Device Control Features:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <span>Enroll MacOS, Windows, iOS, and Android devices</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <span>Remote lock, restart, and shutdown devices</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <span>Monitor device health, battery, and connectivity</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <span>Execute custom commands remotely</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <span>Real-time device status and location tracking</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4">
          <h5 className="font-medium text-indigo-900 mb-2">Getting Started:</h5>
          <p className="text-sm text-indigo-700">
            Go to <strong>MDM</strong> to create your first device profile. 
            You'll get a QR code or enrollment link to add devices to your organization.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'organization',
    title: 'Organization & Security',
    subtitle: 'Manage users, roles, and permissions',
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">User Management</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Invite team members</li>
                <li>• Assign roles and permissions</li>
                <li>• Control access levels</li>
              </ul>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Security</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Role-based access control</li>
                <li>• Audit logs and monitoring</li>
                <li>• Secure key management</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-2">Available Roles:</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="font-medium text-red-600">Administrator:</span>
              <span className="text-gray-600 ml-1">Full access to everything</span>
            </div>
            <div>
              <span className="font-medium text-blue-600">Developer:</span>
              <span className="text-gray-600 ml-1">Can manage servers & deployments</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Viewer:</span>
              <span className="text-gray-600 ml-1">Read-only access</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'next-steps',
    title: 'Ready to Get Started!',
    subtitle: 'Here\'s what you should do next',
    content: (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 mb-6">
            You're all set! Here are some recommended first steps to get the most out of Pulse:
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                1
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Add Your First Server</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Go to Servers → Add Server to connect your first infrastructure component
                </p>
              </div>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                2
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Create Your First Configuration</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Use our AI assistant or create custom Ansible playbooks for automation
                </p>
              </div>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                3
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Enroll Your Devices</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Set up MDM profiles to manage your team's laptops and mobile devices
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mt-6">
          <p className="text-sm text-gray-700 text-center">
            <strong>Need help?</strong> Click the tutorial icon in the top navigation anytime to replay this guide, 
            or check out our documentation and support resources.
          </p>
        </div>
      </div>
    )
  }
];

export default function Onboarding({ isOpen, onClose, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setDirection(stepIndex > currentStep ? 1 : -1);
    setCurrentStep(stepIndex);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  if (!isOpen) return null;

  const currentStepData = onboardingSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">{currentStepData.title}</h2>
            <span className="text-sm text-gray-500">
              {currentStep + 1} of {onboardingSteps.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50">
          <div className="flex space-x-2">
            {onboardingSteps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-500'
                    : index < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 px-6 py-8 overflow-y-auto">
          <div className="mb-6">
            <p className="text-lg text-gray-600">{currentStepData.subtitle}</p>
          </div>
          
          <div className="relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
              >
                {currentStepData.content}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            {onboardingSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => handleStepClick(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-blue-500'
                    : index < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <span>{currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}