'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ServerIcon,
  CubeTransparentIcon,
  ChartBarIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  EyeIcon,
  CpuChipIcon,
  DocumentTextIcon,
  BugAntIcon,
  BeakerIcon,
  CloudIcon,
  CommandLineIcon,
  CircleStackIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setAnimationStep((prev) => (prev + 1) % 7);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resources = [
    { icon: ServerIcon, label: 'Servers', subtitle: 'Physical & Virtual' },
    { icon: CubeTransparentIcon, label: 'Kubernetes', subtitle: 'Container Orchestration' },
    { icon: CloudIcon, label: 'Cloud Resources', subtitle: 'Multi-Cloud Infrastructure' },
    { icon: CircleStackIcon, label: 'Databases', subtitle: 'Data Storage Systems' },
  ];


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CubeTransparentIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Pulse Hive Architecture
                </h2>
                <p className="text-sm text-indigo-100">
                  Enterprise Infrastructure Monitoring & AI-Powered Operations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="flex-1 p-6 bg-gradient-to-br from-gray-50 to-gray-100 relative min-h-0">
          <div className="grid grid-cols-3 gap-6 h-full items-center">
            
            {/* Layer 1: Infrastructure */}
            <div className="flex flex-col justify-center">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center justify-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Infrastructure
                </h3>
              </div>
              <div className="space-y-3">
                {resources.map((resource, index) => {
                  const IconComponent = resource.icon;
                  const isActive = animationStep >= 0 && animationStep <= 1;
                  return (
                    <div
                      key={index}
                      className={`relative p-3 rounded-lg border-2 transition-all duration-500 ${
                        isActive
                          ? 'bg-blue-50 border-blue-300 shadow-lg scale-105'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                          <IconComponent className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{resource.label}</p>
                          <p className="text-xs text-gray-500">{resource.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Layer 2: Hive Agents */}
            <div className="flex flex-col justify-center">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center justify-center">
                  <CubeTransparentIcon className="h-5 w-5 mr-2 text-purple-600" />
                  Hive Agents
                </h3>
              </div>
              
              <div className="flex flex-col items-center">
                <div
                  className={`relative p-4 rounded-xl border-2 transition-all duration-500 w-full ${
                    animationStep >= 1 && animationStep <= 3
                      ? 'bg-purple-50 border-purple-300 shadow-lg scale-105'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <CubeTransparentIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Collection</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex items-center justify-center space-x-2">
                        <DocumentTextIcon className="h-3 w-3" />
                        <span>Logs</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <ChartBarIcon className="h-3 w-3" />
                        <span>Metrics</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <CpuChipIcon className="h-3 w-3" />
                        <span>System Data</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Processing indicators */}
                  {(animationStep >= 1 && animationStep <= 3) && (
                    <div className="absolute top-2 right-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
                
                {/* Agent capabilities */}
                <div className="grid grid-cols-2 gap-2 mt-3 w-full">
                  <div className="p-2 bg-white rounded border border-gray-200 text-center">
                    <ShieldCheckIcon className="h-4 w-4 text-green-600 mx-auto mb-1" />
                    <p className="text-xs font-medium text-gray-700">Security</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-gray-200 text-center">
                    <BugAntIcon className="h-4 w-4 text-red-600 mx-auto mb-1" />
                    <p className="text-xs font-medium text-gray-700">Issues</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 3: Analysis & Response */}
            <div className="flex flex-col justify-center">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center justify-center">
                  <EyeIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Analysis & Response
                </h3>
              </div>
              
              <div className="space-y-4">
                {/* Observability Platforms Box */}
                <div
                  className={`relative p-4 rounded-xl border-2 transition-all duration-500 ${
                    animationStep >= 2 && animationStep <= 3
                      ? 'bg-indigo-50 border-indigo-300 shadow-lg scale-105'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="text-center mb-3">
                    <div className="mx-auto w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                      <EyeIcon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Observability Platforms</h4>
                    <p className="text-xs text-gray-600 mt-1">External monitoring tools</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded border text-center">
                      <ChartBarIcon className="h-3 w-3 text-indigo-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Analytics</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <DocumentTextIcon className="h-3 w-3 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">APM</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <BeakerIcon className="h-3 w-3 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Dashboards</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <GlobeAltIcon className="h-3 w-3 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">APIs</p>
                    </div>
                  </div>
                </div>

                {/* Pulse Hive Box */}
                <div
                  className={`relative p-4 rounded-xl border-2 transition-all duration-500 ${
                    animationStep >= 4
                      ? 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-300 shadow-lg scale-105'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="text-center mb-3">
                    <div className="mx-auto w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mb-2">
                      <LightBulbIcon className="h-5 w-5 text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Pulse Hive</h4>
                    <p className="text-xs text-gray-600 mt-1">AI-powered management</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded border text-center">
                      <BugAntIcon className="h-3 w-3 text-red-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Detection</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <ShieldCheckIcon className="h-3 w-3 text-green-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Auto-Fix</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <CommandLineIcon className="h-3 w-3 text-purple-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Remote</p>
                    </div>
                    <div className="p-2 bg-white rounded border text-center">
                      <ChartBarIcon className="h-3 w-3 text-blue-500 mx-auto mb-1" />
                      <p className="text-xs text-gray-700">Analytics</p>
                    </div>
                  </div>
                  
                  {/* AI Processing indicator */}
                  {animationStep >= 4 && (
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
                        <div className="absolute inset-0 w-3 h-3 bg-orange-600 rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2-Way Communication Arrows for Pulse Hive */}
          {animationStep >= 5 && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Curved arrow from Pulse Hive back to Infrastructure */}
              <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 10 }}>
                <defs>
                  <marker
                    id="arrowhead-back"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                    className="fill-orange-600"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" />
                  </marker>
                </defs>
                
                {/* Return path from Pulse Hive to Infrastructure */}
                <path
                  d="M 85% 75% Q 95% 50% 85% 30% Q 70% 10% 15% 25%"
                  stroke="#ea580c"
                  strokeWidth="3"
                  fill="none"
                  markerEnd="url(#arrowhead-back)"
                  strokeDasharray="8,4"
                  className="animate-pulse"
                />
              </svg>
              
              {/* Flow label */}
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
                <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium border border-orange-300">
                  ⟷ 2-Way: Auto-Remediation & Management
                </div>
              </div>
            </div>
          )}
          
          {/* Animation progress indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="flex space-x-2">
              {[0, 1, 2, 3, 4, 5, 6].map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    animationStep >= step ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 flex-1 min-w-0">
              <p className="font-medium">Enterprise-Grade Infrastructure Monitoring with AI</p>
              <p className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Infrastructure → Hive Agents → Observability (1-way) | Pulse Hive (2-way AI management)</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors ml-4 flex-shrink-0"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}