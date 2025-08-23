'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface MdmDevice {
  id: string;
  deviceName: string;
  deviceId: string;
  serialNumber?: string;
  model?: string;
  osVersion?: string;
  architecture?: string;
  status: string;
  lastSeen?: string;
  enrolledAt: string;
  isActive: boolean;
  // Computed fields for sync
  suggestedAssetTag?: string;
  suggestedAssetType?: string;
  suggestedBrand?: string;
  existingAssetId?: string; // If already synced
}

interface SyncPreview {
  assetTag: string;
  assetType: string;
  brand: string;
  model: string;
  serialNumber?: string;
  status: string;
  condition: string;
  specifications: Record<string, any>;
}

interface MdmAssetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export default function MdmAssetSyncModal({ isOpen, onClose, onSyncComplete }: MdmAssetSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<MdmDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'select' | 'preview' | 'syncing'>('select');
  const [syncPreview, setSyncPreview] = useState<Record<string, SyncPreview>>({});
  const [syncOptions, setSyncOptions] = useState({
    autoGenerateAssetTags: true,
    defaultLocation: '',
    defaultDepartment: '',
    defaultCondition: 'good',
  });

  // Fetch available MDM devices
  useEffect(() => {
    if (isOpen) {
      fetchAvailableDevices();
    }
  }, [isOpen]);

  const fetchAvailableDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mdm/devices/available-for-sync', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Combine available and already synced devices
        const allDevices = [...(data.available || []), ...(data.alreadySynced || [])];
        setDevices(allDevices);
      } else {
        toast.error('Failed to fetch MDM devices');
      }
    } catch (error) {
      console.error('Error fetching MDM devices:', error);
      toast.error('Error loading MDM devices');
    } finally {
      setLoading(false);
    }
  };

  const detectAssetType = (model: string): string => {
    const modelLower = model?.toLowerCase() || '';
    if (modelLower.includes('macbook') || modelLower.includes('laptop')) return 'laptop';
    if (modelLower.includes('imac') || modelLower.includes('desktop')) return 'desktop';
    if (modelLower.includes('ipad') || modelLower.includes('tablet')) return 'tablet';
    if (modelLower.includes('iphone') || modelLower.includes('phone')) return 'phone';
    if (modelLower.includes('monitor') || modelLower.includes('display')) return 'monitor';
    return 'device';
  };

  const extractBrand = (model: string): string => {
    const modelLower = model?.toLowerCase() || '';
    if (modelLower.includes('macbook') || modelLower.includes('imac') || modelLower.includes('ipad') || modelLower.includes('iphone')) return 'Apple';
    if (modelLower.includes('dell')) return 'Dell';
    if (modelLower.includes('hp') || modelLower.includes('hewlett')) return 'HP';
    if (modelLower.includes('lenovo')) return 'Lenovo';
    if (modelLower.includes('asus')) return 'ASUS';
    if (modelLower.includes('microsoft')) return 'Microsoft';
    return 'Unknown';
  };

  const generateAssetTag = (assetType: string, index: number): string => {
    const prefixes: Record<string, string> = {
      laptop: 'LAP',
      desktop: 'DT',
      tablet: 'TAB',
      phone: 'PHN',
      monitor: 'MON',
      device: 'DEV',
    };
    const prefix = prefixes[assetType] || 'DEV';
    return `${prefix}-${(1000 + index).toString().slice(1)}`;
  };

  const mapStatusToCondition = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'online': return 'good';
      case 'offline': return 'fair';
      case 'locked': return 'fair';
      default: return 'good';
    }
  };

  const toggleDevice = (deviceId: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      newSelected.add(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  const toggleAll = () => {
    const availableDevices = devices.filter(d => !d.existingAssetId);
    if (selectedDevices.size === availableDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(availableDevices.map(d => d.id)));
    }
  };

  const generatePreview = () => {
    const preview: Record<string, SyncPreview> = {};
    const selectedDeviceList = devices.filter(d => selectedDevices.has(d.id));
    
    selectedDeviceList.forEach((device, index) => {
      const assetType = detectAssetType(device.model || '');
      const brand = extractBrand(device.model || '');
      
      preview[device.id] = {
        assetTag: generateAssetTag(assetType, index + 1),
        assetType,
        brand,
        model: device.model || device.deviceName,
        serialNumber: device.serialNumber,
        status: 'available',
        condition: mapStatusToCondition(device.status),
        specifications: {
          os: device.osVersion,
          architecture: device.architecture,
          mdmDeviceId: device.id,
          enrolledAt: device.enrolledAt,
        },
      };
    });
    
    setSyncPreview(preview);
    setStep('preview');
  };

  const performSync = async () => {
    setStep('syncing');
    try {
      const response = await fetch('/api/assets/sync-from-mdm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          deviceIds: Array.from(selectedDevices),
          syncPreview,
          options: syncOptions,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Successfully synced ${result.created} assets from MDM devices`);
        onSyncComplete();
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to sync devices');
        setStep('preview');
      }
    } catch (error) {
      console.error('Error syncing devices:', error);
      toast.error('Error syncing devices');
      setStep('preview');
    }
  };

  const getDeviceIcon = (device: MdmDevice) => {
    const assetType = detectAssetType(device.model || '');
    switch (assetType) {
      case 'laptop':
      case 'desktop':
        return <ComputerDesktopIcon className="h-5 w-5 text-blue-500" />;
      case 'phone':
      case 'tablet':
        return <DevicePhoneMobileIcon className="h-5 w-5 text-green-500" />;
      default:
        return <ComputerDesktopIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  const availableDevices = devices.filter(d => !d.existingAssetId);
  const alreadySyncedDevices = devices.filter(d => d.existingAssetId);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {step === 'select' && '🔄 Sync MDM Devices to Assets'}
            {step === 'preview' && '👀 Preview Asset Creation'}
            {step === 'syncing' && '⏳ Syncing Devices...'}
          </h3>
          <button
            onClick={onClose}
            disabled={step === 'syncing'}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {step === 'select' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
                <span>Loading MDM devices...</span>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    📱 Found {availableDevices.length} MDM devices available for sync
                    {alreadySyncedDevices.length > 0 && ` (${alreadySyncedDevices.length} already synced)`}
                  </p>
                </div>

                {availableDevices.length > 0 && (
                  <div className="mb-4 flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDevices.size === availableDevices.length}
                        onChange={toggleAll}
                        className="form-checkbox h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Select All Available Devices</span>
                    </label>
                    <span className="text-sm text-gray-500">
                      {selectedDevices.size} selected
                    </span>
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  {availableDevices.map((device) => (
                    <div
                      key={device.id}
                      className={`p-4 border-b last:border-b-0 hover:bg-gray-50 ${
                        selectedDevices.has(device.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDevices.has(device.id)}
                          onChange={() => toggleDevice(device.id)}
                          className="form-checkbox h-4 w-4 text-blue-600 mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getDeviceIcon(device)}
                            <span className="font-medium text-gray-900">{device.deviceName}</span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                              {device.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            📋 {device.model || 'Unknown Model'} 
                            {device.serialNumber && ` | SN: ${device.serialNumber.slice(0, 10)}...`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            → Asset: {generateAssetTag(detectAssetType(device.model || ''), 1)} | 
                            Type: {detectAssetType(device.model || '')} | 
                            Brand: {extractBrand(device.model || '')}
                          </p>
                        </div>
                      </label>
                    </div>
                  ))}

                  {alreadySyncedDevices.map((device) => (
                    <div key={device.id} className="p-4 border-b last:border-b-0 bg-gray-50 opacity-75">
                      <div className="flex items-start space-x-3">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getDeviceIcon(device)}
                            <span className="font-medium text-gray-600">{device.deviceName}</span>
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                              Already Synced
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            ⚠️ Already synced as asset
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-between">
                  <span className="text-sm text-gray-600">
                    📊 Will create {selectedDevices.size} new assets
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={generatePreview}
                      disabled={selectedDevices.size === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      Preview ({selectedDevices.size})
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                📋 Ready to create {Object.keys(syncPreview).length} assets from selected MDM devices
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {Object.entries(syncPreview).map(([deviceId, preview], index) => {
                const device = devices.find(d => d.id === deviceId);
                return (
                  <div key={deviceId} className="p-4 border-b last:border-b-0">
                    <div className="flex items-start space-x-3">
                      <CheckIcon className="h-5 w-5 text-green-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          Asset {index + 1}: {preview.assetTag}
                        </h4>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Name:</span> {device?.deviceName}
                          </div>
                          <div>
                            <span className="text-gray-600">Type:</span> {preview.assetType}
                          </div>
                          <div>
                            <span className="text-gray-600">Brand:</span> {preview.brand}
                          </div>
                          <div>
                            <span className="text-gray-600">Model:</span> {preview.model}
                          </div>
                          <div>
                            <span className="text-gray-600">Serial:</span> {preview.serialNumber || 'N/A'}
                          </div>
                          <div>
                            <span className="text-gray-600">Condition:</span> {preview.condition}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Specs: {preview.specifications.os}, {preview.specifications.architecture}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={performSync}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Confirm Sync ({Object.keys(syncPreview).length})
              </button>
            </div>
          </>
        )}

        {step === 'syncing' && (
          <div className="text-center py-8">
            <ArrowPathIcon className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Syncing Devices to Assets</h4>
            <p className="text-gray-600">Creating {Object.keys(syncPreview).length} assets from MDM devices...</p>
          </div>
        )}
      </div>
    </div>
  );
}