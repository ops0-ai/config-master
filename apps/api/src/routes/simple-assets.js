const { Router } = require('express');
const { db } = require('../index');
const { assets, users } = require('@config-management/database');
const { eq, and, like, desc, sql, or } = require('drizzle-orm');

const router = Router();

// Simple asset route without type issues
router.get('/', async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Get assets
    const assetList = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.organizationId, organizationId),
        eq(assets.isActive, true)
      ))
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalCountResult = await db
      .select({ count: sql`count(*)` })
      .from(assets)
      .where(and(
        eq(assets.organizationId, organizationId),
        eq(assets.isActive, true)
      ));
    
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

    const stats = {};
    statsResult.forEach(stat => {
      stats[stat.status] = Number(stat.count);
    });

    res.json({
      assets: assetList,
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
router.get('/:id', async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const assetId = req.params.id;

    const asset = await db
      .select()
      .from(assets)
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .limit(1);

    if (!asset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ asset: asset[0] });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create asset
router.post('/', async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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
    const timestamp = Date.now().toString().slice(-6);
    const prefix = (assetType || 'ASSET').substring(0, 3).toUpperCase();
    const assetTag = `${prefix}-${timestamp}`;

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

    res.status(201).json(newAsset[0]);
  } catch (error) {
    console.error('Error creating asset:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Asset tag already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create asset' });
    }
  }
});

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
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

    res.json(updatedAsset[0]);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Delete asset
router.delete('/:id', async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const assetId = req.params.id;

    const deletedAsset = await db
      .update(assets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId)
      ))
      .returning();

    if (!deletedAsset[0]) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

module.exports = { simpleAssetsRoutes: router };