"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canModifyResource = exports.isAdminUser = exports.isSameUser = void 0;
/**
 * Checks if two user IDs are the same
 * @param userId1 First user ID
 * @param userId2 Second user ID
 * @returns True if the IDs are the same, false otherwise
 */
const isSameUser = (userId1, userId2) => {
    return !!userId1 && !!userId2 && userId1 === userId2;
};
exports.isSameUser = isSameUser;
/**
 * Checks if a user has an admin role
 * @param userRole The user's role
 * @returns True if the user is an admin, false otherwise
 */
const isAdminUser = (userRole) => {
    return userRole === 'admin';
};
exports.isAdminUser = isAdminUser;
/**
 * Determines if a user can modify a resource
 * @param userId The ID of the user attempting to modify
 * @param resourceOwnerId The ID of the resource owner
 * @param userRole Optional user role for admin check
 * @returns True if the user can modify the resource, false otherwise
 */
const canModifyResource = (userId, resourceOwnerId, userRole) => {
    return (0, exports.isAdminUser)(userRole) || (0, exports.isSameUser)(userId, resourceOwnerId);
};
exports.canModifyResource = canModifyResource;
