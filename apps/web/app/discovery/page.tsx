import Layout from '@/components/Layout';
import Image from 'next/image';

function DiscoveryContent() {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-8">
      <div className="flex items-center justify-center min-h-full">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative mb-8">
            <div className="animate-bounce">
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
              Infrastructure Discovery
            </h1>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-2xl transform -rotate-1"></div>
              <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-lg">
                <div className="flex items-center justify-center mb-4">
                  <div className="relative">
                    <div className="animate-ping absolute h-4 w-4 bg-green-500 rounded-full opacity-75"></div>
                    <div className="h-4 w-4 bg-green-600 rounded-full"></div>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">
                  Coming Soon
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Phoenix will soon offer intelligent infrastructure discovery to automatically map and catalog your entire IT landscape. 
                  Discover assets, dependencies, and relationships across your infrastructure ecosystem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Layout>
      <DiscoveryContent />
    </Layout>
  );
}