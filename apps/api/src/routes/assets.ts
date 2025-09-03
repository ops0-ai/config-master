import { Router } from 'express';
import { db } from '../index';
import { 
  assets, 
  assetAssignments, 
  assetHistory,
  users 
} from '@config-management/database';
import { eq, and, like, desc, sql, or } from 'drizzle-orm';
import { AuthenticatedRequest, rbacMiddleware } from '../middleware/rbacMiddleware';
import { featureFlagMiddleware } from '../middleware/featureFlags';

const router = Router();

// Helper function to generate asset tag
function generateAssetTag(organizationId: string, assetType: string): string {
  const prefix = assetType.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
}

// Helper function to log asset history
async function logAssetHistory(
  assetId: string,
  action: string,
  oldValues: any,
  newValues: any,
  performedBy: string,
  organizationId: string,
  notes?: string
) {
  await db.insert(assetHistory).values({
    assetId,
    action,
    oldValues,
    newValues,
    performedBy,
    organizationId,
    notes,
  });
}

// Get all assets with pagination and filtering
router.get('/', featureFlagMiddleware('assets'), rbacMiddleware(['asset:read']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const assetType = req.query.assetType as string;
    const assignedUserId = req.query.assignedUserId as string;

    // Build where conditions
    const whereConditions: any[] = [eq(assets.organizationId, organizationId), eq(assets.isActive, true)];
    
    if (search) {
      whereConditions.push(
        or(
          like(assets.assetTag, `%${search}%`),
          like(assets.serialNumber, `%${search}%`),
          like(assets.brand, `%${search}%`),
          like(assets.model, `%${search}%`)
        )
      );
    }
    
    if (status) {
      whereConditions.push(eq(assets.status, status));
    }
    
    if (assetType) {
      whereConditions.push(eq(assets.assetType, assetType));
    }

    // Get assets with assignment info
    const assetsData = await db
      .select({
        id: assets.id,
        assetTag: assets.assetTag,
        serialNumber: assets.serialNumber,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        status: assets.status,
        condition: assets.condition,
        purchaseDate: assets.purchaseDate,
        purchasePrice: assets.purchasePrice,
        currency: assets.currency,
        supplier: assets.supplier,
        warrantyStartDate: assets.warrantyStartDate,
        warrantyEndDate: assets.warrantyEndDate,
        warrantyProvider: assets.warrantyProvider,
        location: assets.location,
        costCenter: assets.costCenter,
        department: assets.department,
        category: assets.category,
        subcategory: assets.subcategory,
        specifications: assets.specifications,
        notes: assets.notes,
        barcode: assets.barcode,
        qrCode: assets.qrCode,
        imageUrl: assets.imageUrl,
        organizationId: assets.organizationId,
        createdBy: assets.createdBy,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
        assignedUserName: users.name,
        assignedUserEmail: users.email,
        assignedAt: assetAssignments.assignedAt,
        assignmentType: assetAssignments.assignmentType,
        expectedReturnDate: assetAssignments.expectedReturnDate,
      })
      .from(assets)
      .leftJoin(
        assetAssignments,
        and(
          eq(assetAssignments.assetId, assets.id),
          eq(assetAssignments.isActive, true)
        )
      )
      .leftJoin(users, eq(users.id, assetAssignments.userId))
      .where(and(...whereConditions))
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by assigned user if specified
    let filteredAssets = assetsData;
    if (assignedUserId) {
      filteredAssets = assetsData.filter(asset => 
        asset.assignedUserEmail && asset.assignedUserEmail.includes(assignedUserId)
      );
    }

    // Get total count
    const totalCountResult = await db
      .select({ count: sql`count(*)` })
      .from(assets)
      .where(and(...whereConditions));
    
    const totalCount = Number(totalCountResult[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // Get stats
    const statsResult = await db
      .select({
        status: assets.status,
        count: sql`count(*)`
      })
      .from(assets)
      .where(and(
        eq(assets.organizationId, organizationId),
        eq(assets.isActive, true)
      ))
      .groupBy(assets.status);

    const stats: Record<string, number> = {};
    statsResult.forEach(stat => {
      stats[stat.status] = Number(stat.count);
    });

    res.json({
      assets: filteredAssets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset
router.get('/:id', featureFlagMiddleware('assets'), rbacMiddleware(['asset:read']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const assetId = req.params.id;

    const asset = await db
      .select({
        id: assets.id,
        assetTag: assets.assetTag,
        serialNumber: assets.serialNumber,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        status: assets.status,
        condition: assets.condition,
        purchaseDate: assets.purchaseDate,
        purchasePrice: assets.purchasePrice,
        currency: assets.currency,
        supplier: assets.supplier,
        warrantyStartDate: assets.warrantyStartDate,
        warrantyEndDate: assets.warrantyEndDate,
        warrantyProvider: assets.warrantyProvider,
        location: assets.location,
        costCenter: assets.costCenter,
        department: assets.department,
        category: assets.category,
        subcategory: assets.subcategory,
        specifications: assets.specifications,
        notes: assets.notes,
        barcode: assets.barcode,
        qrCode: assets.qrCode,
        imageUrl: assets.imageUrl,
        organizationId: assets.organizationId,
        createdBy: assets.createdBy,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
        assignedUserName: users.name,
        assignedUserEmail: users.email,
        assignedAt: assetAssignments.assignedAt,
        assignmentType: assetAssignments.assignmentType,
        expectedReturnDate: assetAssignments.expectedReturnDate,
      })
      .from(assets)
      .leftJoin(
        assetAssignments,
        and(
          eq(assetAssignments.assetId, assets.id),
          eq(assetAssignments.isActive, true)
        )
      )
      .leftJoin(users, eq(users.id, assetAssignments.userId))
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .limit(1);

    if (!asset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get asset history
    const history = await db
      .select()
      .from(assetHistory)
      .where(eq(assetHistory.assetId, assetId))
      .orderBy(desc(assetHistory.createdAt));

    res.json({ 
      asset: asset[0],
      history 
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create new asset
router.post('/', featureFlagMiddleware('assets'), rbacMiddleware(['asset:create']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;

    const {
      serialNumber,
      assetType,
      brand,
      model,
      status = 'available',
      condition = 'good',
      purchaseDate,
      purchasePrice,
      currency = 'USD',
      supplier,
      warrantyStartDate,
      warrantyEndDate,
      warrantyProvider,
      location,
      costCenter,
      department,
      category,
      subcategory,
      specifications = {},
      notes,
      barcode,
      qrCode,
      imageUrl,
    } = req.body;

    // Generate asset tag
    const assetTag = generateAssetTag(organizationId, assetType || 'ASSET');

    // Check if asset tag already exists
    const existingAsset = await db
      .select()
      .from(assets)
      .where(and(eq(assets.assetTag, assetTag), eq(assets.organizationId, organizationId)))
      .limit(1);

    if (existingAsset.length > 0) {
      const newTag = generateAssetTag(organizationId, assetType || 'ASSET');
      return res.status(400).json({ 
        error: 'Asset tag collision detected',
        suggestedTag: newTag
      });
    }

    const newAsset = await db.insert(assets).values({
      assetTag,
      serialNumber: serialNumber || null,
      assetType: assetType || 'Equipment',
      brand: brand || 'Unknown',
      model: model || 'Unknown',
      status,
      condition,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice ? String(purchasePrice) : null,
      currency,
      supplier: supplier || null,
      warrantyStartDate: warrantyStartDate || null,
      warrantyEndDate: warrantyEndDate || null,
      warrantyProvider: warrantyProvider || null,
      location: location || null,
      costCenter: costCenter || null,
      department: department || null,
      category: category || null,
      subcategory: subcategory || null,
      specifications,
      notes: notes || null,
      barcode: barcode || null,
      qrCode: qrCode || null,
      imageUrl: imageUrl || null,
      organizationId,
      createdBy: userId,
    }).returning();

    // Log asset creation
    await logAssetHistory(
      newAsset[0].id,
      'created',
      null,
      newAsset[0],
      userId,
      organizationId,
      'Asset created'
    );

    res.status(201).json(newAsset[0]);
  } catch (error: any) {
    console.error('Error creating asset:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Asset tag already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create asset' });
    }
  }
});

// Update asset
router.put('/:id', featureFlagMiddleware('assets'), rbacMiddleware(['asset:update']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;
    const assetId = req.params.id;

    const currentAsset = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .limit(1);

    if (!currentAsset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.organizationId;
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.assetTag; // Don't allow changing asset tag

    // Handle date fields - convert empty strings and invalid dates to null
    const dateFields = ['purchaseDate', 'warrantyStartDate', 'warrantyEndDate', 'expectedReturnDate'];
    dateFields.forEach(field => {
      if (updateData[field] === '' || updateData[field] === 'null' || updateData[field] === 'undefined') {
        updateData[field] = null;
      } else if (updateData[field]) {
        try {
          const date = new Date(updateData[field]);
          if (isNaN(date.getTime())) {
            updateData[field] = null;
          }
        } catch (e) {
          updateData[field] = null;
        }
      }
    });

    // Ensure price is a string if provided
    if (updateData.purchasePrice) {
      updateData.purchasePrice = String(updateData.purchasePrice);
    }
    
    updateData.updatedAt = new Date();

    const updatedAsset = await db
      .update(assets)
      .set(updateData)
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .returning();

    // Log asset update
    await logAssetHistory(
      assetId,
      'updated',
      currentAsset[0],
      updatedAsset[0],
      userId,
      organizationId,
      'Asset updated'
    );

    res.json(updatedAsset[0]);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset (soft delete)
router.delete('/:id', featureFlagMiddleware('assets'), rbacMiddleware(['asset:delete']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;
    const assetId = req.params.id;

    const currentAsset = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .limit(1);

    if (!currentAsset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const deletedAsset = await db
      .update(assets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .returning();

    // Log asset deletion
    await logAssetHistory(
      assetId,
      'deleted',
      currentAsset[0],
      { ...currentAsset[0], isActive: false },
      userId,
      organizationId,
      'Asset deleted'
    );

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// Asset assignment endpoint
router.post('/assignments', featureFlagMiddleware('assets'), rbacMiddleware(['asset:assign']), async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId!;
    const assignedBy = req.user!.id;
    
    // Handle multiple possible field names for compatibility
    const { 
      assetId, asset_id, 
      assignedUserId, userId, user_id,
      assignmentType, assignment_type,
      expectedReturnDate, expected_return_date,
      notes 
    } = req.body;
    
    const finalAssetId = assetId || asset_id;
    const finalUserId = assignedUserId || userId || user_id;
    const finalAssignmentType = assignmentType || assignment_type || 'permanent';
    const finalExpectedReturnDate = expectedReturnDate || expected_return_date;
    
    if (!finalAssetId || !finalUserId) {
      return res.status(400).json({ error: 'Asset ID and user ID are required' });
    }
    
    // Check if asset exists and belongs to organization
    const asset = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, finalAssetId),
        eq(assets.organizationId, organizationId)
      ))
      .limit(1);
      
    if (!asset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Deactivate any existing active assignments for this asset
    await db
      .update(assetAssignments)
      .set({ 
        isActive: false,
        returnedAt: new Date(),
        returnedBy: assignedBy
      })
      .where(and(
        eq(assetAssignments.assetId, finalAssetId),
        eq(assetAssignments.isActive, true)
      ));
    
    // Create new assignment
    const [assignment] = await db
      .insert(assetAssignments)
      .values({
        assetId: finalAssetId,
        userId: finalUserId,
        assignedBy,
        organizationId,
        assignmentType: finalAssignmentType,
        assignmentNotes: notes || null,
        expectedReturnDate: finalExpectedReturnDate ? finalExpectedReturnDate : null,
        isActive: true
      })
      .returning();
    
    // Update asset status
    await db
      .update(assets)
      .set({ 
        status: 'assigned',
        updatedAt: new Date()
      })
      .where(eq(assets.id, finalAssetId));
    
    // Log history
    await logAssetHistory(
      finalAssetId,
      'assigned',
      { status: asset[0].status },
      { status: 'assigned', assignedTo: finalUserId },
      assignedBy,
      organizationId,
      notes
    );
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning asset:', error);
    res.status(500).json({ error: 'Failed to assign asset' });
  }
});

// Sync assets from MDM devices
router.post('/sync-from-mdm', featureFlagMiddleware('assets'), rbacMiddleware(['asset:create']), async (req: AuthenticatedRequest, res) => {
  try {
    const { mdmDevices } = await import('@config-management/database');
    const organizationId = req.user!.organizationId!;
    const createdBy = req.user!.id;
    
    const { deviceIds, syncPreview, options } = req.body;
    
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'Device IDs are required' });
    }
    
    if (!syncPreview || typeof syncPreview !== 'object') {
      return res.status(400).json({ error: 'Sync preview data is required' });
    }
    
    // Verify all MDM devices exist and belong to the organization
    const mdmDevicesList = await db
      .select()
      .from(mdmDevices)
      .where(and(
        eq(mdmDevices.organizationId, organizationId),
        eq(mdmDevices.isActive, true)
      ));
    
    const validDeviceIds = mdmDevicesList
      .filter(device => deviceIds.includes(device.id))
      .map(device => device.id);
    
    if (validDeviceIds.length === 0) {
      return res.status(400).json({ error: 'No valid MDM devices found' });
    }
    
    // Check for devices already synced
    const existingAssets = await db
      .select({ mdmDeviceId: assets.mdmDeviceId })
      .from(assets)
      .where(and(
        eq(assets.organizationId, organizationId),
        eq(assets.isActive, true)
      ));
    
    const alreadyLinkedDevices = existingAssets
      .map(asset => asset.mdmDeviceId)
      .filter(Boolean);
    
    const devicesToSync = validDeviceIds.filter(deviceId => 
      !alreadyLinkedDevices.includes(deviceId)
    );
    
    if (devicesToSync.length === 0) {
      return res.status(400).json({ 
        error: 'All selected devices are already synced as assets' 
      });
    }
    
    // Create assets for each device
    const createdAssets = [];
    const errors = [];
    
    for (const deviceId of devicesToSync) {
      const previewData = syncPreview[deviceId];
      if (!previewData) {
        errors.push(`Missing sync preview data for device ${deviceId}`);
        continue;
      }
      
      try {
        // Generate unique asset tag
        const timestamp = Date.now().toString().slice(-6);
        const assetTag = `${previewData.assetTag}-${timestamp}` || generateAssetTag(organizationId, previewData.assetType);
        
        const [newAsset] = await db
          .insert(assets)
          .values({
            assetTag,
            serialNumber: previewData.serialNumber || null,
            assetType: previewData.assetType,
            brand: previewData.brand,
            model: previewData.model,
            status: previewData.status || 'available',
            condition: previewData.condition || 'good',
            specifications: previewData.specifications || {},
            location: options?.defaultLocation || null,
            department: options?.defaultDepartment || null,
            mdmDeviceId: deviceId,
            organizationId,
            createdBy,
            isActive: true,
          })
          .returning();
        
        // Log asset creation
        await logAssetHistory(
          newAsset.id,
          'created',
          {},
          newAsset,
          createdBy,
          organizationId,
          `Asset created from MDM device sync (Device ID: ${deviceId})`
        );
        
        createdAssets.push(newAsset);
      } catch (error: any) {
        console.error(`Error creating asset for device ${deviceId}:`, error);
        if (error.code === '23505') { // Unique constraint violation
          errors.push(`Asset tag already exists for device ${deviceId}`);
        } else {
          errors.push(`Failed to create asset for device ${deviceId}: ${error.message}`);
        }
      }
    }
    
    const response = {
      success: true,
      created: createdAssets.length,
      errors: errors.length,
      assets: createdAssets,
      errorDetails: errors,
    };
    
    if (errors.length > 0) {
      response.success = createdAssets.length > 0;
    }
    
    const statusCode = createdAssets.length > 0 ? 201 : 400;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('Error syncing assets from MDM:', error);
    res.status(500).json({ error: 'Failed to sync assets from MDM devices' });
  }
});

export { router as assetsRoutes };