import Layout from '@/components/Layout';
import Image from 'next/image';

function IaCContent() {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-8">
      <div className="flex items-center justify-center min-h-full">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative mb-8">
            <div className="animate-pulse">
              <Image
                src="/images/phoenix.svg"
                alt="Phoenix Logo"
                width={120}
                height={120}
                className="mx-auto opacity-80"
              />
            </div>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Infrastructure as Code
            </h1>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-2xl transform rotate-1"></div>
              <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-lg">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">
                  Coming Soon
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Phoenix is preparing advanced Infrastructure as Code capabilities to streamline your infrastructure management. 
                  Define, deploy, and manage your infrastructure with enterprise-grade automation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IaCPage() {
  return (
    <Layout>
      <IaCContent />
    </Layout>
  );
}