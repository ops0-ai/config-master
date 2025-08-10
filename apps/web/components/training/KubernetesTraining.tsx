'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface KubernetesTrainingProps {
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
    title: 'Kubernetes Architecture & Security Model',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Learning Objectives</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Understand Kubernetes cluster architecture</li>
            <li>Learn about Pod security contexts and policies</li>
            <li>Master RBAC (Role-Based Access Control)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Kubernetes Cluster Architecture</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">Control Plane Components</h4>
              <ul className="text-purple-800 space-y-1">
                <li>• <strong>API Server:</strong> Frontend for Kubernetes API</li>
                <li>• <strong>etcd:</strong> Key-value store for cluster data</li>
                <li>• <strong>Scheduler:</strong> Assigns pods to nodes</li>
                <li>• <strong>Controller Manager:</strong> Manages controllers</li>
              </ul>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Worker Node Components</h4>
              <ul className="text-green-800 space-y-1">
                <li>• <strong>kubelet:</strong> Node agent</li>
                <li>• <strong>kube-proxy:</strong> Network proxy</li>
                <li>• <strong>Container Runtime:</strong> Runs containers</li>
                <li>• <strong>Pods:</strong> Smallest deployable units</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">RBAC Best Practices</h3>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <pre className="text-sm text-gray-800">{`# Example: Create a role with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
  
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: development
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io`}</pre>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Container Security & Pod Security Standards',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ Common Kubernetes Security Risks</h3>
          <p className="text-red-800">Misconfigured security contexts and overly permissive RBAC are major attack vectors.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h4 className="font-semibold text-red-900">Running as Root</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Containers running with root privileges pose security risks</p>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm font-mono text-red-600"># Bad Example - Running as root</p>
                <pre className="text-sm text-gray-800 mt-1">{`apiVersion: v1
kind: Pod
metadata:
  name: insecure-pod
spec:
  containers:
  - name: app
    image: nginx
    # No security context - runs as root by default`}</pre>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Good Example - Non-root user</p>
                <pre className="text-sm text-gray-800 mt-1">{`apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  containers:
  - name: app
    image: nginx
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              <h4 className="font-semibold text-yellow-900">Privileged Containers</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Privileged containers have access to host resources</p>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Pod Security Standards - Restricted</p>
                <pre className="text-sm text-gray-800 mt-1">{`apiVersion: v1
kind: Pod
metadata:
  name: restricted-pod
  labels:
    pod-security.kubernetes.io/enforce: restricted
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginx
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
              <h4 className="font-semibold text-blue-900">Security Checklist</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Enable Pod Security Standards</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Use non-root containers</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Implement Network Policies</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Scan images for vulnerabilities</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Use secrets management</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Resource Management & Scaling',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-4">Resource Requests and Limits</h3>
          <p className="text-gray-600 mb-4">Proper resource management ensures cluster stability and prevents resource starvation.</p>
          
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm text-gray-800">{`apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:    # Minimum guaranteed resources
        memory: "64Mi"
        cpu: "250m"
      limits:      # Maximum allowed resources  
        memory: "128Mi"
        cpu: "500m"`}</pre>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Horizontal Pod Autoscaler (HPA)</h3>
          <div className="bg-gray-50 p-4 rounded">
            <pre className="text-sm text-gray-800">{`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`}</pre>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">Quality of Service Classes</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Guaranteed</h4>
              <p className="text-green-800 text-sm">Requests = Limits for all containers</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Burstable</h4>
              <p className="text-yellow-800 text-sm">Has requests but limits != requests</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2">BestEffort</h4>
              <p className="text-red-800 text-sm">No requests or limits specified</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: 'Quiz: Kubernetes Knowledge Check',
    type: 'quiz',
    content: null
  }
];

const quizQuestions = [
  {
    question: "Which Kubernetes component stores all cluster data?",
    options: [
      "API Server",
      "etcd",
      "Scheduler",
      "kubelet"
    ],
    correct: 1,
    explanation: "etcd is the key-value store that holds all cluster data including configuration, state, and metadata."
  },
  {
    question: "What is the principle of least privilege in Kubernetes RBAC?",
    options: [
      "Give all users cluster-admin access",
      "Grant minimum permissions necessary for a task",
      "Use the default service account for all pods",
      "Disable authentication entirely"
    ],
    correct: 1,
    explanation: "The principle of least privilege means granting only the minimum permissions necessary to perform required tasks."
  },
  {
    question: "Which security context setting prevents containers from running as root?",
    options: [
      "allowPrivilegeEscalation: false",
      "runAsNonRoot: true",
      "readOnlyRootFilesystem: true",
      "privileged: false"
    ],
    correct: 1,
    explanation: "runAsNonRoot: true ensures that containers cannot run with UID 0 (root), enhancing security."
  },
  {
    question: "What happens when a pod exceeds its memory limit?",
    options: [
      "It gets more memory allocated",
      "It gets throttled",
      "It gets killed (OOMKilled)",
      "Nothing happens"
    ],
    correct: 2,
    explanation: "When a pod exceeds its memory limit, it gets killed by the Out of Memory (OOM) killer."
  },
  {
    question: "Which QoS class has the highest scheduling priority?",
    options: [
      "BestEffort",
      "Burstable", 
      "Guaranteed",
      "All classes have equal priority"
    ],
    correct: 2,
    explanation: "Guaranteed QoS class pods have the highest priority and are least likely to be evicted during resource pressure."
  }
];

export default function KubernetesTraining({ onBack, onProgress, initialProgress, isCompleted }: KubernetesTrainingProps) {
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
            <CommandLineIcon className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kubernetes Management</h1>
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
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentLesson / lessons.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Content */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-2">
            {isQuiz ? (
              <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500" />
            ) : (
              <BookOpenIcon className="h-6 w-6 text-blue-500" />
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
                              className="text-blue-500"
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