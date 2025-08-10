'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  KeyIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { pemKeysApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface PemKey {
  id: string;
  name: string;
  description?: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export default function PemKeysPage() {
  const [pemKeys, setPemKeys] = useState<PemKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKey, setEditingKey] = useState<PemKey | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privateKey: '',
  });

  useEffect(() => {
    loadPemKeys();
  }, []);

  const loadPemKeys = async () => {
    try {
      setLoading(true);
      const response = await pemKeysApi.getAll();
      setPemKeys(response.data);
    } catch (error) {
      toast.error('Failed to load PEM keys');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.privateKey && !editingKey) {
      toast.error('Private key is required');
      return;
    }

    // Validate PEM key format
    if (formData.privateKey && !isValidPemKey(formData.privateKey)) {
      toast.error('Invalid PEM key format. Please paste a valid private key.');
      return;
    }
    
    try {
      if (editingKey) {
        await pemKeysApi.update(editingKey.id, {
          name: formData.name,
          description: formData.description,
        });
        toast.success('PEM key updated successfully');
      } else {
        await pemKeysApi.create(formData);
        toast.success('PEM key added successfully');
      }
      
      await loadPemKeys();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save PEM key');
    }
  };

  const handleEdit = (pemKey: PemKey) => {
    setEditingKey(pemKey);
    setFormData({
      name: pemKey.name,
      description: pemKey.description || '',
      privateKey: '', // Never pre-populate private key for security
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PEM key? This action cannot be undone.')) {
      return;
    }

    try {
      await pemKeysApi.delete(id);
      toast.success('PEM key deleted successfully');
      await loadPemKeys();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete PEM key');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      privateKey: '',
    });
    setEditingKey(null);
    setShowModal(false);
    setShowPrivateKey(false);
  };

  const isValidPemKey = (key: string): boolean => {
    const pemPattern = /-----BEGIN [A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+PRIVATE KEY-----/;
    return pemPattern.test(key.trim());
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFormData({ ...formData, privateKey: content });
        
        // Auto-set name based on filename if not already set
        if (!formData.name) {
          const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
          setFormData(prev => ({ ...prev, name: fileName }));
        }
      };
      reader.readAsText(file);
    }
  };

  const generateKeyPair = () => {
    const instructions = `
To generate a new SSH key pair, run these commands on your system:

# Generate a new RSA key pair
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Or generate an Ed25519 key pair (recommended)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Then copy the private key content
cat ~/.ssh/id_rsa  # or ~/.ssh/id_ed25519
    `;

    navigator.clipboard.writeText(instructions.trim());
    toast.success('SSH key generation instructions copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="page-title">PEM Keys</h1>
          <p className="text-muted mt-1">
            Securely manage SSH private keys for server connections
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateKeyPair}
            className="btn btn-secondary btn-md"
          >
            <DocumentTextIcon className="h-5 w-5 mr-2" />
            Generate Instructions
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary btn-md"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add PEM Key
          </button>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <ShieldCheckIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 mb-1">
              Security Information
            </h3>
            <p className="text-sm text-yellow-700">
              Private keys are encrypted with AES-256-GCM and stored securely. 
              Keys are automatically cleaned up from temporary storage after use.
              Never share your private keys or store them in plain text.
            </p>
          </div>
        </div>
      </div>

      {/* PEM Keys Grid */}
      <div className="grid grid-cols-1 gap-6">
        {pemKeys.map((pemKey) => (
          <div key={pemKey.id} className="card hover:shadow-md transition-shadow">
            <div className="card-content">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <KeyIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {pemKey.name}
                    </h3>
                    {pemKey.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {pemKey.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>🔐 Fingerprint: {pemKey.fingerprint}</span>
                      <span>📅 Added: {new Date(pemKey.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(pemKey)}
                    className="btn btn-ghost btn-sm"
                    title="Edit PEM Key"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pemKey.id)}
                    className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                    title="Delete PEM Key"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {pemKeys.length === 0 && (
          <div className="text-center py-12">
            <KeyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No PEM keys yet</h3>
            <p className="text-gray-600 mb-6">Add your first SSH private key to start connecting to servers.</p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={generateKeyPair}
                className="btn btn-secondary btn-md"
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Generate Key Pair
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-primary btn-md"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add PEM Key
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingKey ? 'Edit PEM Key' : 'Add New PEM Key'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Key Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                    placeholder="production-web-server"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    placeholder="SSH key for production web servers"
                  />
                </div>
                
                {!editingKey && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Private Key *
                    </label>
                    
                    {/* Upload options */}
                    <div className="mb-4">
                      <label className="btn btn-secondary btn-sm cursor-pointer">
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Upload Key File
                        <input
                          type="file"
                          accept=".pem,.key,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="ml-3 text-sm text-gray-500">or paste below</span>
                    </div>
                    
                    <div className="relative">
                      <textarea
                        value={formData.privateKey}
                        onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                        className="input font-mono text-sm"
                        rows={10}
                        required
                        placeholder="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC..."
                        style={{ 
                          filter: showPrivateKey ? 'none' : 'blur(4px)',
                          transition: 'filter 0.2s'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
                        title={showPrivateKey ? 'Hide private key' : 'Show private key'}
                      >
                        {showPrivateKey ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    
                    <p className="mt-2 text-xs text-gray-500">
                      Paste your private key content. Keys are encrypted with AES-256-GCM before storage.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                >
                  {editingKey ? 'Update Key' : 'Add Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}