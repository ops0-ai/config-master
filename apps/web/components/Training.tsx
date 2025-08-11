'use client';

import { useState, useEffect } from 'react';
import {
  CloudIcon,
  CommandLineIcon,
  CogIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  PlayIcon,
  ClockIcon,
  BookOpenIcon,
  StarIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import AwsTraining from './training/AwsTraining';
import KubernetesTraining from './training/KubernetesTraining';
import ConfigManagementTraining from './training/ConfigManagementTraining';

interface TrainingModule {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  duration: string;
  lessons: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  completed: boolean;
  progress: number;
  color: string;
}

const trainingModules: TrainingModule[] = [
  {
    id: 'aws',
    name: 'AWS Infrastructure Security',
    description: 'Learn AWS best practices, common misconfigurations, and security hardening techniques.',
    icon: CloudIcon,
    duration: '2.5 hours',
    lessons: 8,
    difficulty: 'Intermediate',
    completed: false,
    progress: 0,
    color: 'bg-orange-500'
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Management',
    description: 'Master Kubernetes deployment, scaling, security, and troubleshooting best practices.',
    icon: CommandLineIcon,
    duration: '3 hours',
    lessons: 10,
    difficulty: 'Advanced',
    completed: false,
    progress: 0,
    color: 'bg-blue-500'
  },
  {
    id: 'config-management',
    name: 'Configuration Management',
    description: 'Understand infrastructure as code, Ansible automation, and configuration drift prevention.',
    icon: CogIcon,
    duration: '2 hours',
    lessons: 6,
    difficulty: 'Beginner',
    completed: false,
    progress: 0,
    color: 'bg-green-500'
  }
];

export default function Training() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [modules, setModules] = useState<TrainingModule[]>(trainingModules);

  useEffect(() => {
    // Load progress from localStorage
    const savedProgress = localStorage.getItem('training-progress');
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        setModules(prev => prev.map(module => ({
          ...module,
          ...progress[module.id]
        })));
      } catch (error) {
        console.error('Error loading training progress:', error);
      }
    }
  }, []);

  const saveProgress = (moduleId: string, progress: number, completed: boolean) => {
    const savedProgress = JSON.parse(localStorage.getItem('training-progress') || '{}');
    savedProgress[moduleId] = { progress, completed };
    localStorage.setItem('training-progress', JSON.stringify(savedProgress));
    
    setModules(prev => prev.map(module => 
      module.id === moduleId 
        ? { ...module, progress, completed }
        : module
    ));
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const completedModules = modules.filter(m => m.completed).length;
  const totalProgress = modules.reduce((acc, m) => acc + m.progress, 0) / modules.length;

  if (selectedModule) {
    const module = modules.find(m => m.id === selectedModule);
    if (!module) return null;

    const moduleComponents = {
      aws: AwsTraining,
      kubernetes: KubernetesTraining,
      'config-management': ConfigManagementTraining,
    };
    
    const ModuleComponent = moduleComponents[selectedModule as keyof typeof moduleComponents];

    if (!ModuleComponent) return null;

    return (
      <ModuleComponent
        onBack={() => setSelectedModule(null)}
        onProgress={(progress: number, completed: boolean) => 
          saveProgress(selectedModule, progress, completed)
        }
        initialProgress={module.progress}
        isCompleted={module.completed}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="page-title flex items-center space-x-3">
            <AcademicCapIcon className="h-8 w-8 text-blue-600" />
            <span>Infrastructure Awareness Training</span>
          </h1>
          <p className="text-muted mt-1">
            Master cloud infrastructure, security best practices, and configuration management
          </p>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <BookOpenIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Modules</p>
                <p className="text-2xl font-bold text-gray-900">{modules.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedModules}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Progress</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round(totalProgress)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <TrophyIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Certificates</p>
                <p className="text-2xl font-bold text-gray-900">{completedModules}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Training Modules */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Training Modules</h2>
          <p className="text-sm text-gray-600">Choose a module to start your learning journey</p>
        </div>
        
        <div className="card-content p-0">
          <div className="divide-y divide-gray-200">
            {modules.map((module) => (
              <div key={module.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 ${module.color} rounded-lg`}>
                      <module.icon className="h-6 w-6 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {module.name}
                        </h3>
                        {module.completed && (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(module.difficulty)}`}>
                          {module.difficulty}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{module.description}</p>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <ClockIcon className="h-4 w-4" />
                          <span>{module.duration}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <BookOpenIcon className="h-4 w-4" />
                          <span>{module.lessons} lessons</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <StarIcon className="h-4 w-4" />
                          <span>{module.progress}% complete</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {module.progress > 0 && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                module.completed ? 'bg-green-500' : module.color.replace('bg-', 'bg-')
                              }`}
                              style={{ width: `${module.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedModule(module.id)}
                    className="btn btn-primary btn-md flex items-center space-x-2"
                  >
                    <PlayIcon className="h-4 w-4" />
                    <span>{module.progress > 0 ? 'Continue' : 'Start'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div className="mt-8 card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Recommended Learning Path</h2>
          <p className="text-sm text-gray-600">Follow this sequence for optimal learning experience</p>
        </div>
        
        <div className="card-content">
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <CogIcon className="h-5 w-5 text-green-600" />
                <span className="font-medium">Configuration Management</span>
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <CloudIcon className="h-5 w-5 text-orange-600" />
                <span className="font-medium">AWS Infrastructure</span>
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex items-center space-x-2">
                <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <CommandLineIcon className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Kubernetes</span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              ~7.5 hours total
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}