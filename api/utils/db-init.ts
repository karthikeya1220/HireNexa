import User, { IUser } from '../models/User';

/**
 * Database initialization utility that runs on server startup
 * to check for and fix common database issues
 */
export async function initializeDatabase() {
  try {
    console.log('[DB] Running database initialization checks...');
    
    // Check for and fix duplicate users
    await checkForDuplicateUsers();
    
    console.log('[DB] Database initialization complete');
  } catch (error) {
    console.error('[DB] Error during database initialization:', error);
  }
}

// Define an interface for the duplicate user entry
interface DuplicateUserEntry {
  existing: IUser;
  duplicate: IUser;
}

/**
 * Check for and fix duplicate users in the database
 */
async function checkForDuplicateUsers() {
  try {
    // Get all users
    const allUsers = await User.find({});
    console.log(`[DB] Found ${allUsers.length} users in database`);
    
    // Check for email duplicates
    const emailMap = new Map<string, IUser>();
    const duplicates: DuplicateUserEntry[] = [];
    
    allUsers.forEach(user => {
      if (emailMap.has(user.email)) {
        duplicates.push({ 
          existing: emailMap.get(user.email)!, 
          duplicate: user 
        });
      } else {
        emailMap.set(user.email, user);
      }
    });
    
    if (duplicates.length === 0) {
      console.log('[DB] No duplicate users found');
      return;
    }
    
    console.log(`[DB] Found ${duplicates.length} duplicate users, fixing...`);
    
    // Fix duplicates
    for (const { existing, duplicate } of duplicates) {
      // If duplicate has admin role but existing doesn't, update existing
      if (duplicate.role === 'admin' && existing.role !== 'admin') {
        console.log(`[DB] Updating user ${existing.email} to admin role`);
        existing.role = 'admin';
        await existing.save();
      }
      
      // Delete the duplicate
      console.log(`[DB] Removing duplicate user: ${duplicate.email}`);
      await User.deleteOne({ _id: duplicate._id });
    }
    
    console.log('[DB] Duplicate users fixed');
  } catch (error) {
    console.error('[DB] Error checking for duplicate users:', error);
  }
}