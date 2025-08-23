import { Router } from 'express';
import { db } from '../index';
import { 
  assets, 
  assetAssignments, 
  assetHistory,
  users 
} from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest, rbacMiddleware } from '../middleware/rbacMiddleware';

const router = Router();

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

// Create asset assignment
router.post('/', rbacMiddleware(['asset:assign']), async (req: AuthenticatedRequest, res) => {
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

// Return asset
router.put('/:assignmentId/return', rbacMiddleware(['asset:assign']), async (req: AuthenticatedRequest, res) => {
  try {
    const { assignmentId } = req.params;
    const { returnNotes, condition } = req.body;
    const organizationId = req.user!.organizationId!;
    const returnedBy = req.user!.id;
    
    // Get the assignment
    const [assignment] = await db
      .select()
      .from(assetAssignments)
      .where(and(
        eq(assetAssignments.id, assignmentId),
        eq(assetAssignments.organizationId, organizationId),
        eq(assetAssignments.isActive, true)
      ))
      .limit(1);
      
    if (!assignment) {
      return res.status(404).json({ error: 'Active assignment not found' });
    }
    
    // Mark assignment as returned
    await db
      .update(assetAssignments)
      .set({
        isActive: false,
        returnedAt: new Date(),
        returnedBy,
        returnNotes
      })
      .where(eq(assetAssignments.id, assignmentId));
    
    // Update asset status
    await db
      .update(assets)
      .set({ 
        status: 'available',
        condition: condition || 'good',
        updatedAt: new Date()
      })
      .where(eq(assets.id, assignment.assetId));
    
    // Log history
    await logAssetHistory(
      assignment.assetId,
      'returned',
      { status: 'assigned' },
      { status: 'available', condition: condition || 'good' },
      returnedBy,
      organizationId,
      returnNotes
    );
    
    res.json({ message: 'Asset returned successfully' });
  } catch (error) {
    console.error('Error returning asset:', error);
    res.status(500).json({ error: 'Failed to return asset' });
  }
});

// Get assignments for an asset
router.get('/asset/:assetId', rbacMiddleware(['asset:read']), async (req: AuthenticatedRequest, res) => {
  try {
    const { assetId } = req.params;
    const organizationId = req.user!.organizationId!;
    
    const assignments = await db
      .select({
        id: assetAssignments.id,
        assetId: assetAssignments.assetId,
        userId: assetAssignments.userId,
        userName: users.name,
        userEmail: users.email,
        assignedBy: assetAssignments.assignedBy,
        assignedAt: assetAssignments.assignedAt,
        returnedAt: assetAssignments.returnedAt,
        returnedBy: assetAssignments.returnedBy,
        assignmentType: assetAssignments.assignmentType,
        expectedReturnDate: assetAssignments.expectedReturnDate,
        assignmentNotes: assetAssignments.assignmentNotes,
        returnNotes: assetAssignments.returnNotes,
        isActive: assetAssignments.isActive
      })
      .from(assetAssignments)
      .leftJoin(users, eq(users.id, assetAssignments.userId))
      .where(and(
        eq(assetAssignments.assetId, assetId),
        eq(assetAssignments.organizationId, organizationId)
      ))
      .orderBy(desc(assetAssignments.assignedAt));
    
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching asset assignments:', error);
    res.status(500).json({ error: 'Failed to fetch asset assignments' });
  }
});

// Get assignments for a user
router.get('/user/:userId', rbacMiddleware(['asset:read']), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const organizationId = req.user!.organizationId!;
    
    const assignments = await db
      .select({
        id: assetAssignments.id,
        assetId: assetAssignments.assetId,
        assetTag: assets.assetTag,
        assetType: assets.assetType,
        brand: assets.brand,
        model: assets.model,
        assignedAt: assetAssignments.assignedAt,
        returnedAt: assetAssignments.returnedAt,
        assignmentType: assetAssignments.assignmentType,
        expectedReturnDate: assetAssignments.expectedReturnDate,
        isActive: assetAssignments.isActive
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assets.id, assetAssignments.assetId))
      .where(and(
        eq(assetAssignments.userId, userId),
        eq(assetAssignments.organizationId, organizationId)
      ))
      .orderBy(desc(assetAssignments.assignedAt));
    
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching user assignments:', error);
    res.status(500).json({ error: 'Failed to fetch user assignments' });
  }
});

export { router as assetAssignmentsRoutes };