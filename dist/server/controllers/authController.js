"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserFromAuth = exports.updateUserRole = exports.getAllUsers = exports.updateUser = exports.getCurrentUser = void 0;
const db_1 = require("../db");
const User_1 = require("../models/User");
const findUser = async (uid) => {
    const { data, error } = await db_1.supabaseAdmin.from('users').select('*').eq('uid', uid).maybeSingle();
    if (error)
        throw error;
    return data;
};
// Get current user data
const getCurrentUser = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await findUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({
            uid: user.uid,
            email: user.email,
            name: user.name,
            role: user.role,
        });
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
};
exports.getCurrentUser = getCurrentUser;
// Update user data
const updateUser = async (req, res) => {
    var _a, _b, _c;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { email, name, role, profile_complete } = req.body;
        // Identity always comes from the verified token — never from the body.
        if (!userId) {
            return res.status(401).json({ error: 'User ID is required' });
        }
        const user = await findUser(userId);
        // If user doesn't exist, create a new one (email falls back to the token's)
        if (!user) {
            const finalEmail = email || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.email);
            if (!finalEmail) {
                return res.status(400).json({ error: 'Email is required when creating a new user' });
            }
            const { data: newUser, error: createError } = await db_1.supabaseAdmin
                .from('users')
                .insert({
                uid: userId,
                email: finalEmail,
                name: (typeof name === 'string' && name.trim()) || finalEmail.split('@')[0],
                role: 'user', // Role is never taken from the client payload
                profile_complete: profile_complete === true,
            })
                .select('*')
                .single();
            if (createError)
                throw createError;
            return res.status(201).json((0, User_1.toPublicUser)(newUser));
        }
        // Update existing user with any provided fields
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email && typeof email === 'string')
            updateData.email = email;
        if (typeof profile_complete === 'boolean')
            updateData.profile_complete = profile_complete;
        if (role && ((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === 'admin')
            updateData.role = role; // Only admins can update roles
        let updated = user;
        if (Object.keys(updateData).length > 0) {
            const { data, error } = await db_1.supabaseAdmin
                .from('users')
                .update(updateData)
                .eq('uid', userId)
                .select('*')
                .maybeSingle();
            if (error)
                throw error;
            if (!data) {
                return res.status(404).json({ error: 'User not found' });
            }
            updated = data;
        }
        return res.status(200).json((0, User_1.toPublicUser)(updated));
    }
    catch (error) {
        console.error('Error updating user:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 409) {
            return res.status(409).json({ error: 'A user with that email already exists' });
        }
        return res.status(500).json({ error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
// Admin only: Get all users
const getAllUsers = async (req, res) => {
    try {
        const { data, error } = await db_1.supabaseAdmin
            .from('users')
            .select('uid, email, name, role, created_at');
        if (error)
            throw error;
        return res.status(200).json(data);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
};
exports.getAllUsers = getAllUsers;
// Admin only: Update user role
const updateUserRole = async (req, res) => {
    try {
        const { uid, role } = req.body;
        if (!uid || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!['admin', 'user', 'recruiter'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const { data: user, error } = await db_1.supabaseAdmin
            .from('users')
            .update({ role })
            .eq('uid', uid)
            .select('*')
            .maybeSingle();
        if (error)
            throw error;
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json((0, User_1.toPublicUser)(user));
    }
    catch (error) {
        console.error('Error updating user role:', error);
        if ((0, db_1.httpStatusForDbError)(error) === 400) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        return res.status(500).json({ error: 'Failed to update user role' });
    }
};
exports.updateUserRole = updateUserRole;
// Create the user record for the currently authenticated user.
// Requires the `authenticate` middleware: uid/email come from the verified
// token and can never be spoofed via the request body.
const createUserFromAuth = async (req, res) => {
    var _a, _b;
    try {
        const uid = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const email = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        const { name } = req.body || {};
        if (!uid || !email) {
            return res.status(401).json({ error: 'Authenticated user with an email is required' });
        }
        const existingUser = await findUser(uid);
        if (existingUser) {
            return res.status(200).json({
                message: 'User already exists',
                user: (0, User_1.toPublicUser)(existingUser),
            });
        }
        try {
            const { data: newUser, error } = await db_1.supabaseAdmin
                .from('users')
                .insert({
                uid,
                email,
                name: (typeof name === 'string' && name.trim()) || email.split('@')[0],
                role: 'user', // Role is always assigned server-side
            })
                .select('*')
                .single();
            if (error)
                throw error;
            return res.status(201).json({
                message: 'User created successfully',
                user: (0, User_1.toPublicUser)(newUser),
            });
        }
        catch (saveError) {
            if ((0, db_1.httpStatusForDbError)(saveError) === 409) {
                const conflictUser = await findUser(uid);
                if (conflictUser) {
                    return res.status(200).json({
                        message: 'User already exists',
                        user: (0, User_1.toPublicUser)(conflictUser),
                    });
                }
            }
            throw saveError;
        }
    }
    catch (error) {
        console.error('Error creating user from auth:', error);
        return res.status(500).json({ error: 'Failed to create user' });
    }
};
exports.createUserFromAuth = createUserFromAuth;
