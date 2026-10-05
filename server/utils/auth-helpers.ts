/**
 * Checks if two user IDs are the same
 * @param userId1 First user ID
 * @param userId2 Second user ID
 * @returns True if the IDs are the same, false otherwise
 */
export const isSameUser = (userId1?: string, userId2?: string): boolean => {
  return !!userId1 && !!userId2 && userId1 === userId2;
};

/**
 * Checks if a user has an admin role
 * @param userRole The user's role
 * @returns True if the user is an admin, false otherwise
 */
export const isAdminUser = (userRole?: string): boolean => {
  return userRole === 'admin';
};

/**
 * Determines if a user can modify a resource
 * @param userId The ID of the user attempting to modify
 * @param resourceOwnerId The ID of the resource owner
 * @param userRole Optional user role for admin check
 * @returns True if the user can modify the resource, false otherwise
 */
export const canModifyResource = (userId?: string, resourceOwnerId?: string, userRole?: string): boolean => {
  return isAdminUser(userRole) || isSameUser(userId, resourceOwnerId);
}; 