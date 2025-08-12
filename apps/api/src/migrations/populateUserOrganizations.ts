import { users, organizations, userOrganizations } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'config_management'}`;
const client = postgres(connectionString);
const db = drizzle(client);

export async function populateUserOrganizations() {
  try {
    console.log('🔄 Starting user organizations migration...');
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users`);
    
    for (const user of allUsers) {
      if (user.organizationId) {
        // Check if relationship already exists
        const existing = await db
          .select()
          .from(userOrganizations)
          .where(and(
            eq(userOrganizations.userId, user.id),
            eq(userOrganizations.organizationId, user.organizationId)
          ));
        
        if (existing.length === 0) {
          // Check if user is the owner of the organization
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, user.organizationId));
          
          const isOwner = org && org.ownerId === user.id;
          
          // Insert user-organization relationship
          await db.insert(userOrganizations).values({
            userId: user.id,
            organizationId: user.organizationId,
            role: isOwner ? 'owner' : 'member',
            isActive: user.isActive,
          });
          
          console.log(`✅ Added ${user.email} to organization ${user.organizationId} as ${isOwner ? 'owner' : 'member'}`);
        } else {
          console.log(`⏭️  Skipping ${user.email} - already in user_organizations`);
        }
      }
    }
    
    console.log('✅ User organizations migration completed');
  } catch (error) {
    console.error('❌ Error during user organizations migration:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateUserOrganizations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}