'use client';

import { useState } from 'react';
import {
  ArrowLeftIcon,
  CloudIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface AwsTrainingProps {
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
    title: 'AWS Security Fundamentals',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Learning Objectives</h3>
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Understand AWS Shared Responsibility Model</li>
            <li>Learn Identity and Access Management (IAM) best practices</li>
            <li>Identify common AWS security misconfigurations</li>
          </ul>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">AWS Shared Responsibility Model</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-900 mb-2">AWS Responsibility (Security OF the Cloud)</h4>
              <ul className="text-orange-800 space-y-1">
                <li>• Physical infrastructure security</li>
                <li>• Network controls and firewall protection</li>
                <li>• Host operating system patching</li>
                <li>• Hypervisor patching</li>
                <li>• Service availability and durability</li>
              </ul>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Customer Responsibility (Security IN the Cloud)</h4>
              <ul className="text-green-800 space-y-1">
                <li>• Guest OS updates and security patches</li>
                <li>• Application security and updates</li>
                <li>• Identity and access management</li>
                <li>• Network traffic protection</li>
                <li>• Data encryption (at rest and in transit)</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-4">IAM Best Practices</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold">Enable MFA for all users</h4>
                <p className="text-gray-600">Multi-factor authentication adds an extra layer of security</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold">Follow principle of least privilege</h4>
                <p className="text-gray-600">Grant only the minimum permissions required</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold">Use IAM roles instead of users for applications</h4>
                <p className="text-gray-600">Avoid embedding credentials in application code</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold">Regularly rotate access keys</h4>
                <p className="text-gray-600">Implement key rotation policies and monitor key usage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Common S3 Misconfigurations',
    type: 'lesson',
    content: (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ Critical S3 Security Issues</h3>
          <p className="text-red-800">S3 misconfigurations are among the most common causes of data breaches in AWS.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h4 className="font-semibold text-red-900">Public Read Access</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Accidentally making S3 buckets publicly readable</p>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm font-mono text-red-600"># Bad Example</p>
                <pre className="text-sm text-gray-800 mt-1">{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}`}</pre>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Good Example - Specific IP restriction</p>
                <pre className="text-sm text-gray-800 mt-1">{`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        }
      }
    }
  ]
}`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              <h4 className="font-semibold text-yellow-900">Missing Encryption</h4>
            </div>
            <div className="space-y-3">
              <p className="text-gray-700">Data stored without encryption at rest</p>
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-mono text-green-600"># Enable default encryption</p>
                <pre className="text-sm text-gray-800 mt-1">{`aws s3api put-bucket-encryption \\
  --bucket my-bucket \\
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
              <h4 className="font-semibold text-blue-900">Best Practices Checklist</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Enable S3 Block Public Access</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Enable versioning and MFA delete</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Configure CloudTrail logging</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Enable server-side encryption</span>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Use lifecycle policies for cost optimization</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Quiz: AWS Security Knowledge Check',
    type: 'quiz',
    content: null // Will be handled separately in the quiz component
  }
];

const quizQuestions = [
  {
    question: "In the AWS Shared Responsibility Model, who is responsible for patching the guest operating system?",
    options: [
      "AWS",
      "Customer",
      "Both AWS and Customer",
      "Third-party vendors"
    ],
    correct: 1,
    explanation: "The customer is responsible for patching the guest OS, applications, and managing their data security."
  },
  {
    question: "Which IAM best practice helps prevent unauthorized access even if credentials are compromised?",
    options: [
      "Using long passwords",
      "Enabling MFA (Multi-Factor Authentication)",
      "Creating multiple IAM users",
      "Using root account for daily tasks"
    ],
    correct: 1,
    explanation: "MFA adds an extra layer of security by requiring a second form of authentication beyond just credentials."
  },
  {
    question: "What is the most secure way to grant S3 bucket access to a specific application running on EC2?",
    options: [
      "Embed AWS access keys in application code",
      "Use IAM roles attached to the EC2 instance",
      "Share root account credentials",
      "Make the bucket publicly accessible"
    ],
    correct: 1,
    explanation: "IAM roles provide temporary credentials and eliminate the need to embed long-term keys in application code."
  },
  {
    question: "Which S3 configuration setting helps prevent accidental public access?",
    options: [
      "S3 Transfer Acceleration",
      "S3 Cross-Region Replication",
      "S3 Block Public Access",
      "S3 Intelligent Tiering"
    ],
    correct: 2,
    explanation: "S3 Block Public Access provides account and bucket level settings to prevent public access, even if policies allow it."
  },
  {
    question: "What should you enable to audit API calls and changes to AWS resources?",
    options: [
      "CloudWatch Logs",
      "CloudTrail",
      "Config Rules",
      "VPC Flow Logs"
    ],
    correct: 1,
    explanation: "CloudTrail provides audit trails of API calls, helping track who did what and when in your AWS account."
  }
];

export default function AwsTraining({ onBack, onProgress, initialProgress, isCompleted }: AwsTrainingProps) {
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
    
    const completed = score >= 80; // 80% pass rate
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
            <CloudIcon className="h-8 w-8 text-orange-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AWS Infrastructure Security</h1>
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
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
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
              <BookOpenIcon className="h-6 w-6 text-orange-500" />
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
                              className="text-orange-500"
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
                  
                  {/* Show correct answers */}
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