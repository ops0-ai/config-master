'use client';

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-2 text-gray-600">
          Connect external services to extend your configuration management capabilities
        </p>
      </div>

      {/* Cloud Integrations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Cloud Providers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* AWS Integration */}
          <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.75 11.35a4.32 4.32 0 0 0-.79-.26 4.18 4.18 0 0 0-.84-.09 4.34 4.34 0 0 0-3.47 1.69 4.19 4.19 0 0 0-.85 2.56v.3a4.17 4.17 0 0 0 .85 2.55 4.34 4.34 0 0 0 3.47 1.69 4.18 4.18 0 0 0 .84-.09c.28-.06.54-.15.79-.26v1.31H22V11.35zM10.32 5.1H8.54V3.32h1.78zm5.15 0h-1.78V3.32h1.78z"/>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-gray-900">Amazon Web Services</h3>
                <p className="text-sm text-gray-600">Connect to AWS to import EC2 instances</p>
              </div>
            </div>
            <a 
              href="/settings/integrations/cloud/aws"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Configure AWS
            </a>
          </div>

          {/* Placeholder for other cloud providers */}
          <div className="border border-gray-200 rounded-lg p-4 opacity-50">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-gray-400">Google Cloud Platform</h3>
                <p className="text-sm text-gray-400">Coming Soon</p>
              </div>
            </div>
            <button 
              disabled
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
            >
              Configure GCP
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 opacity-50">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8 8-3.59 8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-gray-400">Microsoft Azure</h3>
                <p className="text-sm text-gray-400">Coming Soon</p>
              </div>
            </div>
            <button 
              disabled
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
            >
              Configure Azure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}