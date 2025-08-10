'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  CogIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface ConfigManagementTrainingProps {
  onBack: () => void;
  onProgress: (progress: number, completed: boolean) => void;
  initialProgress: number;
  isCompleted: boolean;
}

interface Lesson {
  id: number;
  title: string;
  content: React.ReactNode;
  type: 'lesson' | 'quiz';
}

const lessons: Lesson[] = [
  {
    id: 1,
    title: 'Infrastructure as Code Fundamentals',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Learning Objectives</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Understand Infrastructure as Code (IaC) principles</li>
            <li>Learn configuration drift detection and prevention</li>
            <li>Master Ansible automation best practices</li>
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">What is Infrastructure as Code?</h3>
          <p className="text-gray-600 mb-4">
            Infrastructure as Code (IaC) is the practice of managing and provisioning computing infrastructure through machine-readable definition files, rather than physical hardware configuration or interactive configuration tools.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">✅ IaC Benefits</h4>
              <ul className="text-green-800 space-y-1">
                <li>• Consistency across environments</li>
                <li>• Version control for infrastructure</li>
                <li>• Faster deployment and scaling</li>
                <li>• Reduced human errors</li>
                <li>• Cost optimization through automation</li>
              </ul>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2">❌ Manual Configuration Problems</h4>
              <ul className="text-red-800 space-y-1">
                <li>• Configuration drift over time</li>
                <li>• Inconsistent environments</li>
                <li>• Manual errors and omissions</li>
                <li>• Difficulty in scaling</li>
                <li>• No audit trail</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Configuration Management Tools</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-red-500 text-white rounded-lg flex items-center justify-center mx-auto mb-2">
                <CogIcon className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Ansible</h4>
              <p className="text-sm text-gray-600">Agentless automation</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-lg flex items-center justify-center mx-auto mb-2">
                <CogIcon className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Terraform</h4>
              <p className="text-sm text-gray-600">Infrastructure provisioning</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-purple-500 text-white rounded-lg flex items-center justify-center mx-auto mb-2">
                <CogIcon className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Chef</h4>
              <p className="text-sm text-gray-600">Ruby-based configuration</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-lg flex items-center justify-center mx-auto mb-2">
                <CogIcon className="h-6 w-6" />
              </div>
              <h4 className="font-semibold">Puppet</h4>
              <p className="text-sm text-gray-600">Declarative language</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Ansible Best Practices',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ Common Ansible Mistakes</h3>
          <p className="text-red-800">Poor playbook structure and insecure practices can lead to configuration drift and security vulnerabilities.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h4 className="font-semibold text-red-900">Hardcoded Passwords</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Never store sensitive data in plain text playbooks</p>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm font-mono text-red-600"># Bad Example</p>
                <pre className="text-sm text-gray-800 mt-1">{`---
- name: Create database user
  mysql_user:
    name: app_user
    password: "supersecret123"  # Never do this!
    state: present`}</pre>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Good Example - Using Ansible Vault</p>
                <pre className="text-sm text-gray-800 mt-1">{`---
- name: Create database user
  mysql_user:
    name: app_user
    password: "{{ vault_db_password }}"
    state: present

# Create vault file:
# ansible-vault create group_vars/all/vault.yml
# vault_db_password: supersecret123`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              <h4 className="font-semibold text-yellow-900">Not Using Idempotency</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Ensure tasks can be run multiple times safely</p>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Good Example - Idempotent task</p>
                <pre className="text-sm text-gray-800 mt-1">{`---
- name: Ensure nginx is installed and running
  systemd:
    name: nginx
    state: started
    enabled: yes
  
- name: Configure nginx
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    backup: yes
  notify:
    - restart nginx
    
handlers:
- name: restart nginx
  systemd:
    name: nginx
    state: restarted`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
              <h4 className="font-semibold text-blue-900">Playbook Structure Best Practices</h4>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded">
                <pre className="text-sm text-gray-800">{`project/
├── inventories/
│   ├── production/
│   │   ├── hosts
│   │   └── group_vars/
│   └── staging/
│       ├── hosts
│       └── group_vars/
├── roles/
│   ├── common/
│   ├── webserver/
│   └── database/
├── playbooks/
├── group_vars/
├── host_vars/
└── ansible.cfg`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Configuration Drift Detection',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">What is Configuration Drift?</h3>
          <p className="text-gray-600 mb-4">
            Configuration drift occurs when the actual state of systems deviates from their intended configuration over time due to manual changes, updates, or other factors.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-900 mb-2">Causes of Drift</h4>
              <ul className="text-orange-800 space-y-1">
                <li>• Manual configuration changes</li>
                <li>• Application updates</li>
                <li>• Security patches</li>
                <li>• User modifications</li>
                <li>• System administrator changes</li>
              </ul>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2">Impact of Drift</h4>
              <ul className="text-red-800 space-y-1">
                <li>• Security vulnerabilities</li>
                <li>• Inconsistent environments</li>
                <li>• Application failures</li>
                <li>• Compliance violations</li>
                <li>• Debugging difficulties</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Drift Detection Strategies</h3>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">1. Continuous Monitoring</h4>
              <p className="text-green-800 mb-3">Regular automated checks comparing actual vs. desired state</p>
              <div className="bg-white p-3 rounded">
                <pre className="text-sm text-gray-800">{`# Ansible check mode (dry run)
ansible-playbook site.yml --check --diff

# Continuous compliance checking
ansible-playbook compliance.yml --schedule="0 */4 * * *"`}</pre>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">2. Infrastructure Testing</h4>
              <p className="text-blue-800 mb-3">Automated tests to verify system configuration</p>
              <div className="bg-white p-3 rounded">
                <pre className="text-sm text-gray-800">{`# Example with Ansible + Testinfra
def test_nginx_is_installed(host):
    nginx = host.package("nginx")
    assert nginx.is_installed

def test_nginx_running_and_enabled(host):
    nginx = host.service("nginx")
    assert nginx.is_running
    assert nginx.is_enabled`}</pre>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">3. Version Control Integration</h4>
              <p className="text-purple-800 mb-3">Track all configuration changes through Git</p>
              <div className="bg-white p-3 rounded">
                <pre className="text-sm text-gray-800">{`# GitOps workflow
1. All changes go through pull requests
2. Automated testing on changes
3. Deployment approval process
4. Automated rollback capabilities`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: 'Quiz: Configuration Management Knowledge Check',
    type: 'quiz',
    content: null
  }
];

const quizQuestions = [
  {
    question: "What is the main benefit of Infrastructure as Code (IaC)?",
    options: [
      "Faster server hardware",
      "Consistency and repeatability of infrastructure",
      "Cheaper cloud costs",
      "Better user interfaces"
    ],
    correct: 1,
    explanation: "IaC provides consistency and repeatability by managing infrastructure through code, reducing manual errors and drift."
  },
  {
    question: "How should sensitive data like passwords be handled in Ansible playbooks?",
    options: [
      "Store them in plain text in the playbook",
      "Use Ansible Vault to encrypt sensitive data",
      "Put them in environment variables only",
      "Hardcode them in the inventory file"
    ],
    correct: 1,
    explanation: "Ansible Vault encrypts sensitive data, keeping passwords and keys secure while maintaining automation."
  },
  {
    question: "What does 'idempotency' mean in configuration management?",
    options: [
      "Running tasks as fast as possible",
      "Tasks can be run multiple times with the same result",
      "Tasks must run in a specific order",
      "Tasks should never be repeated"
    ],
    correct: 1,
    explanation: "Idempotency ensures that running the same task multiple times produces the same result, making automation safe and predictable."
  },
  {
    question: "What is configuration drift?",
    options: [
      "When servers move to different locations",
      "When actual system state deviates from intended configuration",
      "When configuration files become corrupted",
      "When networks become slow"
    ],
    correct: 1,
    explanation: "Configuration drift occurs when systems deviate from their intended configuration due to manual changes or other factors."
  },
  {
    question: "Which Ansible command allows you to see what changes would be made without actually applying them?",
    options: [
      "ansible-playbook --dry-run",
      "ansible-playbook --check",
      "ansible-playbook --preview",
      "ansible-playbook --simulate"
    ],
    correct: 1,
    explanation: "The --check flag runs Ansible in check mode, showing what would change without actually making any modifications."
  }
];

export default function ConfigManagementTraining({ onBack, onProgress, initialProgress, isCompleted }: ConfigManagementTrainingProps) {
  const [currentLesson, setCurrentLesson] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const handleNextLesson = () => {
    if (currentLesson < lessons.length) {
      setCurrentLesson(currentLesson + 1);
      const progress = (currentLesson / lessons.length) * 100;
      onProgress(progress, false);
    }
  };

  const handlePreviousLesson = () => {
    if (currentLesson > 1) {
      setCurrentLesson(currentLesson - 1);
    }
  };

  const handleQuizSubmit = () => {
    let correct = 0;
    quizAnswers.forEach((answer, index) => {
      if (answer === quizQuestions[index].correct) {
        correct++;
      }
    });
    
    const score = (correct / quizQuestions.length) * 100;
    setQuizScore(score);
    setShowQuizResults(true);
    
    const completed = score >= 80;
    onProgress(100, completed);
  };

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers];
    newAnswers[questionIndex] = answerIndex;
    setQuizAnswers(newAnswers);
  };

  const currentLessonData = lessons.find(l => l.id === currentLesson);
  const isQuiz = currentLessonData?.type === 'quiz';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="btn btn-ghost btn-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Modules
          </button>
          <div className="flex items-center space-x-3">
            <CogIcon className="h-8 w-8 text-green-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configuration Management</h1>
              <p className="text-gray-600">Lesson {currentLesson} of {lessons.length}</p>
            </div>
          </div>
        </div>
        
        {isCompleted && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="font-medium">Completed</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentLesson / lessons.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Content */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-2">
            {isQuiz ? (
              <QuestionMarkCircleIcon className="h-6 w-6 text-green-500" />
            ) : (
              <BookOpenIcon className="h-6 w-6 text-green-500" />
            )}
            <h2 className="text-xl font-semibold">{currentLessonData?.title}</h2>
          </div>
        </div>
        
        <div className="card-content">
          {isQuiz ? (
            <div className="space-y-6">
              {!showQuizResults ? (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">Knowledge Check</h3>
                    <p className="text-blue-800">Answer all questions to complete the module. You need 80% or higher to pass.</p>
                  </div>
                  
                  {quizQuestions.map((q, index) => (
                    <div key={index} className="bg-white border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Question {index + 1}: {q.question}</h4>
                      <div className="space-y-2">
                        {q.options.map((option, optIndex) => (
                          <label key={optIndex} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`question-${index}`}
                              value={optIndex}
                              onChange={() => handleQuizAnswer(index, optIndex)}
                              className="text-green-500"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleQuizSubmit}
                    disabled={quizAnswers.length !== quizQuestions.length}
                    className="btn btn-primary btn-lg w-full disabled:opacity-50"
                  >
                    Submit Quiz
                  </button>
                </>
              ) : (
                <div className="space-y-6">
                  <div className={`p-4 rounded-lg ${quizScore >= 80 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <h3 className={`font-semibold mb-2 ${quizScore >= 80 ? 'text-green-900' : 'text-red-900'}`}>
                      Quiz Results
                    </h3>
                    <p className={`${quizScore >= 80 ? 'text-green-800' : 'text-red-800'}`}>
                      You scored {quizScore}% ({quizAnswers.filter((answer, index) => answer === quizQuestions[index].correct).length} out of {quizQuestions.length} correct)
                    </p>
                    {quizScore >= 80 ? (
                      <p className="text-green-800 mt-2">🎉 Congratulations! You passed the module.</p>
                    ) : (
                      <p className="text-red-800 mt-2">Please review the material and retake the quiz.</p>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold">Review:</h4>
                    {quizQuestions.map((q, index) => (
                      <div key={index} className="bg-white border rounded-lg p-4">
                        <h5 className="font-semibold mb-2">Question {index + 1}: {q.question}</h5>
                        <p className="text-green-600 mb-2">✓ Correct answer: {q.options[q.correct]}</p>
                        <p className="text-gray-600 text-sm">{q.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            currentLessonData?.content
          )}
        </div>
      </div>

      {/* Navigation */}
      {!isQuiz && (
        <div className="flex justify-between mt-8">
          <button
            onClick={handlePreviousLesson}
            disabled={currentLesson === 1}
            className="btn btn-secondary btn-md disabled:opacity-50"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Previous
          </button>
          
          <button
            onClick={handleNextLesson}
            disabled={currentLesson === lessons.length}
            className="btn btn-primary btn-md"
          >
            Next
            <ArrowLeftIcon className="h-4 w-4 ml-2 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}