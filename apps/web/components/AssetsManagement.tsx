'use client';

import { useState, useEffect } from 'react';
import { assetsApi, usersApi, assetAssignmentsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
  EyeIcon,
  ComputerDesktopIcon,
  XMarkIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  ClockIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface Asset {
  id: string;
  assetTag: string;
  serialNumber?: string;
  assetType: string;
  brand?: string;
  model?: string;
  status: string;
  condition: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency?: string;
  supplier?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyProvider?: string;
  location?: string;
  costCenter?: string;
  department?: string;
  category?: string;
  subcategory?: string;
  specifications?: any;
  notes?: string;
  barcode?: string;
  qrCode?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedUserEmail?: string;
  assignedAt?: string;
  assignmentType?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AssetStats {
  [status: string]: number;
}

interface AssetsManagementProps {
  initialAssets?: Asset[];
}

export default function AssetsManagement({ initialAssets = [] }: AssetsManagementProps) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AssetStats>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    assetTag: '',
    serialNumber: '',
    assetType: '',
    brand: '',
    model: '',
    status: 'available',
    condition: 'good',
    purchaseDate: '',
    purchasePrice: '',
    currency: 'USD',
    supplier: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    warrantyProvider: '',
    location: '',
    costCenter: '',
    department: '',
    category: '',
    subcategory: '',
    notes: '',
    barcode: '',
    qrCode: '',
    imageUrl: '',
  });

  const [assignmentData, setAssignmentData] = useState({
    userId: '',
    assignmentType: 'permanent',
    expectedReturnDate: '',
    assignmentNotes: '',
    assignmentLocation: '',
  });

  useEffect(() => {
    fetchAssets();
    fetchUsers();
  }, [pagination.page, searchTerm, statusFilter, assetTypeFilter, brandFilter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(assetTypeFilter && { assetType: assetTypeFilter }),
        ...(brandFilter && { brand: brandFilter }),
      };

      const response = await assetsApi.getAll(params);
      setAssets(response.data.assets);
      setStats(response.data.stats);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      assetTag: '',
      serialNumber: '',
      assetType: '',
      brand: '',
      model: '',
      status: 'available',
      condition: 'good',
      purchaseDate: '',
      purchasePrice: '',
      currency: 'USD',
      supplier: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
      warrantyProvider: '',
      location: '',
      costCenter: '',
      department: '',
      category: '',
      subcategory: '',
      notes: '',
      barcode: '',
      qrCode: '',
      imageUrl: '',
    });
  };

  const handleCreateAsset = () => {
    resetForm();
    setSelectedAsset(null);
    setShowCreateModal(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      assetTag: asset.assetTag || '',
      serialNumber: asset.serialNumber || '',
      assetType: asset.assetType || '',
      brand: asset.brand || '',
      model: asset.model || '',
      status: asset.status || 'available',
      condition: asset.condition || 'good',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      purchasePrice: asset.purchasePrice?.toString() || '',
      currency: asset.currency || 'USD',
      supplier: asset.supplier || '',
      warrantyStartDate: asset.warrantyStartDate ? asset.warrantyStartDate.split('T')[0] : '',
      warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.split('T')[0] : '',
      warrantyProvider: asset.warrantyProvider || '',
      location: asset.location || '',
      costCenter: asset.costCenter || '',
      department: asset.department || '',
      category: asset.category || '',
      subcategory: asset.subcategory || '',
      notes: asset.notes || '',
      barcode: asset.barcode || '',
      qrCode: asset.qrCode || '',
      imageUrl: asset.imageUrl || '',
    });
    setShowEditModal(true);
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Are you sure you want to delete asset ${asset.assetTag}?`)) {
      return;
    }

    try {
      await assetsApi.delete(asset.id);
      toast.success('Asset deleted successfully');
      fetchAssets();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast.error(error.response?.data?.error || 'Failed to delete asset');
    }
  };

  const handleSubmitAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
      };

      if (selectedAsset) {
        await assetsApi.update(selectedAsset.id, payload);
        toast.success('Asset updated successfully');
        setShowEditModal(false);
      } else {
        await assetsApi.create(payload);
        toast.success('Asset created successfully');
        setShowCreateModal(false);
      }
      
      fetchAssets();
      resetForm();
    } catch (error: any) {
      console.error('Error saving asset:', error);
      toast.error(error.response?.data?.error || 'Failed to save asset');
    }
  };

  const handleAssignAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssignmentData({
      userId: '',
      assignmentType: 'permanent',
      expectedReturnDate: '',
      assignmentNotes: '',
      assignmentLocation: '',
    });
    setShowAssignModal(true);
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAsset || !assignmentData.userId) {
      toast.error('Please select a user to assign the asset to');
      return;
    }

    try {
      await assetAssignmentsApi.assign({
        assetId: selectedAsset.id,
        ...assignmentData,
      });
      
      toast.success('Asset assigned successfully');
      setShowAssignModal(false);
      fetchAssets();
    } catch (error: any) {
      console.error('Error assigning asset:', error);
      toast.error(error.response?.data?.error || 'Failed to assign asset');
    }
  };

  const handleViewDetails = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'retired':
        return 'bg-gray-100 text-gray-800';
      case 'damaged':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'good':
        return 'bg-blue-100 text-blue-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ComputerDesktopIcon className="h-6 w-6 mr-2" />
              Asset Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and track your organization's assets
            </p>
          </div>
          <button
            onClick={handleCreateAsset}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Asset
          </button>
        </div>

        {/* Stats */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            {Object.entries(stats).map(([status, count]) => (
              <div key={status} className="bg-white p-4 rounded-lg border">
                <div className="text-sm text-gray-600 capitalize">{status}</div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
            <option value="damaged">Damaged</option>
          </select>
          <input
            type="text"
            placeholder="Asset Type"
            value={assetTypeFilter}
            onChange={(e) => setAssetTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Brand"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type & Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Loading assets...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No assets found
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {asset.assetTag}
                        </div>
                        {asset.serialNumber && (
                          <div className="text-sm text-gray-500">
                            SN: {asset.serialNumber}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {asset.assetType}
                        </div>
                        {asset.brand && asset.model && (
                          <div className="text-sm text-gray-500">
                            {asset.brand} {asset.model}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionColor(asset.condition)}`}>
                        {asset.condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {asset.assignedUserName ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {asset.assignedUserName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {asset.assignedUserEmail}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {asset.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(asset)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditAsset(asset)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit Asset"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {asset.status === 'available' && (
                          <button
                            onClick={() => handleAssignAsset(asset)}
                            className="text-green-600 hover:text-green-900"
                            title="Assign Asset"
                          >
                            <UserPlusIcon className="h-4 w-4" />
                          </button>
                        )}
                        {asset.status === 'assigned' && (
                          <button
                            onClick={() => handleAssignAsset(asset)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Reassign Asset"
                          >
                            <UserIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAsset(asset)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Asset"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
              {pagination.totalCount} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!pagination.hasNext}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Asset Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
            }}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <form onSubmit={handleSubmitAsset}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedAsset ? 'Edit Asset' : 'Create New Asset'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Basic Information</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Asset Tag</label>
                        <input
                          type="text"
                          value={formData.assetTag}
                          onChange={(e) => setFormData(prev => ({ ...prev, assetTag: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Auto-generated if empty"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Serial Number</label>
                        <input
                          type="text"
                          value={formData.serialNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Asset Type *</label>
                        <input
                          type="text"
                          value={formData.assetType}
                          onChange={(e) => setFormData(prev => ({ ...prev, assetType: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                          placeholder="e.g., Laptop, Desktop, Monitor"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Brand</label>
                        <input
                          type="text"
                          value={formData.brand}
                          onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Dell, HP, Apple"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <input
                          type="text"
                          value={formData.model}
                          onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="available">Available</option>
                            <option value="assigned">Assigned</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="retired">Retired</option>
                            <option value="damaged">Damaged</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Condition</label>
                          <select
                            value={formData.condition}
                            onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="poor">Poor</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Purchase & Warranty Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Purchase & Warranty</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
                        <input
                          type="date"
                          value={formData.purchaseDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.purchasePrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Currency</label>
                          <select
                            value={formData.currency}
                            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="CAD">CAD</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Supplier</label>
                        <input
                          type="text"
                          value={formData.supplier}
                          onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Warranty Start</label>
                          <input
                            type="date"
                            value={formData.warrantyStartDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, warrantyStartDate: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Warranty End</label>
                          <input
                            type="date"
                            value={formData.warrantyEndDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, warrantyEndDate: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Warranty Provider</label>
                        <input
                          type="text"
                          value={formData.warrantyProvider}
                          onChange={(e) => setFormData(prev => ({ ...prev, warrantyProvider: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Location</label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Office A, Floor 2"
                        />
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div className="md:col-span-2 space-y-4">
                      <h4 className="font-medium text-gray-900">Additional Information</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Cost Center</label>
                          <input
                            type="text"
                            value={formData.costCenter}
                            onChange={(e) => setFormData(prev => ({ ...prev, costCenter: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Department</label>
                          <input
                            type="text"
                            value={formData.department}
                            onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Category</label>
                          <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Additional notes or specifications..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {selectedAsset ? 'Update Asset' : 'Create Asset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowAssignModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmitAssignment}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedAsset.status === 'assigned' ? 'Reassign Asset' : 'Assign Asset'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedAsset.status === 'assigned' 
                        ? `Reassign ${selectedAsset.assetTag} to a different user` 
                        : `Assign ${selectedAsset.assetTag} to a user`}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Select User *</label>
                      <select
                        value={assignmentData.userId}
                        onChange={(e) => setAssignmentData(prev => ({ ...prev, userId: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select a user...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Assignment Type</label>
                      <select
                        value={assignmentData.assignmentType}
                        onChange={(e) => setAssignmentData(prev => ({ ...prev, assignmentType: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="permanent">Permanent</option>
                        <option value="temporary">Temporary</option>
                        <option value="loan">Loan</option>
                      </select>
                    </div>

                    {assignmentData.assignmentType === 'temporary' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Expected Return Date</label>
                        <input
                          type="date"
                          value={assignmentData.expectedReturnDate}
                          onChange={(e) => setAssignmentData(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Assignment Location</label>
                      <input
                        type="text"
                        value={assignmentData.assignmentLocation}
                        onChange={(e) => setAssignmentData(prev => ({ ...prev, assignmentLocation: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Where will this asset be used?"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Assignment Notes</label>
                      <textarea
                        value={assignmentData.assignmentNotes}
                        onChange={(e) => setAssignmentData(prev => ({ ...prev, assignmentNotes: e.target.value }))}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Additional notes about this assignment..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {selectedAsset?.status === 'assigned' ? 'Reassign Asset' : 'Assign Asset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowDetailModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Asset Details</h3>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Asset Tag:</span>
                          <span className="text-sm font-medium">{selectedAsset.assetTag}</span>
                        </div>
                        {selectedAsset.serialNumber && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Serial Number:</span>
                            <span className="text-sm font-medium">{selectedAsset.serialNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Type:</span>
                          <span className="text-sm font-medium">{selectedAsset.assetType}</span>
                        </div>
                        {selectedAsset.brand && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Brand:</span>
                            <span className="text-sm font-medium">{selectedAsset.brand}</span>
                          </div>
                        )}
                        {selectedAsset.model && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Model:</span>
                            <span className="text-sm font-medium">{selectedAsset.model}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Status:</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusColor(selectedAsset.status)}`}>
                            {selectedAsset.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Condition:</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${getConditionColor(selectedAsset.condition)}`}>
                            {selectedAsset.condition}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedAsset.assignedUserName && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Current Assignment</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Assigned To:</span>
                            <span className="text-sm font-medium">{selectedAsset.assignedUserName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Email:</span>
                            <span className="text-sm font-medium">{selectedAsset.assignedUserEmail}</span>
                          </div>
                          {selectedAsset.assignedAt && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Assigned Date:</span>
                              <span className="text-sm font-medium">
                                {new Date(selectedAsset.assignedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {selectedAsset.assignmentType && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Assignment Type:</span>
                              <span className="text-sm font-medium">{selectedAsset.assignmentType}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Purchase Information</h4>
                      <div className="space-y-2">
                        {selectedAsset.purchaseDate && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Purchase Date:</span>
                            <span className="text-sm font-medium">
                              {new Date(selectedAsset.purchaseDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {selectedAsset.purchasePrice && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Purchase Price:</span>
                            <span className="text-sm font-medium">
                              {selectedAsset.currency} {selectedAsset.purchasePrice}
                            </span>
                          </div>
                        )}
                        {selectedAsset.supplier && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Supplier:</span>
                            <span className="text-sm font-medium">{selectedAsset.supplier}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(selectedAsset.warrantyStartDate || selectedAsset.warrantyEndDate) && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Warranty Information</h4>
                        <div className="space-y-2">
                          {selectedAsset.warrantyStartDate && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Warranty Start:</span>
                              <span className="text-sm font-medium">
                                {new Date(selectedAsset.warrantyStartDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {selectedAsset.warrantyEndDate && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Warranty End:</span>
                              <span className="text-sm font-medium">
                                {new Date(selectedAsset.warrantyEndDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {selectedAsset.warrantyProvider && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Warranty Provider:</span>
                              <span className="text-sm font-medium">{selectedAsset.warrantyProvider}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Location & Organization</h4>
                      <div className="space-y-2">
                        {selectedAsset.location && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Location:</span>
                            <span className="text-sm font-medium">{selectedAsset.location}</span>
                          </div>
                        )}
                        {selectedAsset.department && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Department:</span>
                            <span className="text-sm font-medium">{selectedAsset.department}</span>
                          </div>
                        )}
                        {selectedAsset.costCenter && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Cost Center:</span>
                            <span className="text-sm font-medium">{selectedAsset.costCenter}</span>
                          </div>
                        )}
                        {selectedAsset.category && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Category:</span>
                            <span className="text-sm font-medium">{selectedAsset.category}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedAsset.notes && (
                    <div className="md:col-span-2">
                      <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600">{selectedAsset.notes}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleEditAsset(selectedAsset);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Edit Asset
                  </button>
                  {selectedAsset.status === 'available' && (
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleAssignAsset(selectedAsset);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      Assign Asset
                    </button>
                  )}
                  {selectedAsset.status === 'assigned' && (
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleAssignAsset(selectedAsset);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Reassign Asset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}