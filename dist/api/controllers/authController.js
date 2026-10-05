"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserFromAuth = exports.updateUserRole = exports.getAllUsers = exports.updateUser = exports.getCurrentUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const errors_1 = require("../utils/errors");
// Get current user data
const getCurrentUser = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await User_1.default.findOne({ uid: userId });
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
    var _a, _b;
    try {
        const userIdFromAuth = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { email, name, role } = req.body;
        // Identity always comes from the verified token — never from the body.
        const userId = userIdFromAuth;
        // Ensure we have a user ID
        if (!userId) {
            return res.status(401).json({ error: 'User ID is required' });
        }
        // Check if user exists
        let user = await User_1.default.findOne({ uid: userId });
        // If user doesn't exist, create a new one
        if (!user) {
            console.log(`Creating new user with uid: ${userId}`);
            // Validate required fields for new user
            if (!email) {
                return res.status(400).json({ error: 'Email is required when creating a new user' });
            }
            // Create new user — role is never taken from the client payload
            const newUser = new User_1.default({
                uid: userId,
                email,
                name: name || email.split('@')[0],
                role: 'user',
                created_at: new Date(),
                updated_at: new Date()
            });
            user = await newUser.save();
            return res.status(201).json({
                uid: user.uid,
                email: user.email,
                name: user.name,
                role: user.role,
            });
        }
        // Update existing user with any provided fields
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email && typeof email === 'string')
            updateData.email = email;
        if (role && ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'admin')
            updateData.role = role; // Only admins can update roles
        // Only update if we have fields to update
        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date();
            user = await User_1.default.findOneAndUpdate({ uid: userId }, updateData, { new: true, runValidators: true });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
        }
        return res.status(200).json({
            uid: user.uid,
            email: user.email,
            name: user.name,
            role: user.role,
        });
    }
    catch (error) {
        console.error('Error updating user:', error);
        if ((0, errors_1.errCode)(error) === 11000) {
            return res.status(409).json({ error: 'A user with that email already exists' });
        }
        return res.status(500).json({ error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
// Admin only: Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User_1.default.find().select('uid email name role created_at');
        return res.status(200).json(users);
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
        const user = await User_1.default.findOneAndUpdate({ uid }, {
            role,
            updated_at: new Date()
        }, { new: true });
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
        console.error('Error updating user role:', error);
        return res.status(500).json({ error: 'Failed to update user role' });
    }
};
exports.updateUserRole = updateUserRole;
// Create the user record for the currently authenticated Firebase user.
// Requires the `authenticate` middleware: uid/email come from the verified
// ID token and can never be spoofed via the request body.
const createUserFromAuth = async (req, res) => {
    var _a, _b;
    try {
        const uid = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const email = (_b = req.user) === null || _b === void 0 ? void 0 : _b.email;
        const { name } = req.body || {};
        if (!uid || !email) {
            return res.status(401).json({ error: 'Authenticated user with an email is required' });
        }
        const existingUser = await User_1.default.findOne({ uid });
        if (existingUser) {
            return res.status(200).json({
                message: 'User already exists',
                user: {
                    uid: existingUser.uid,
                    email: existingUser.email,
                    name: existingUser.name,
                    role: existingUser.role,
                }
            });
        }
        try {
            const newUser = new User_1.default({
                uid,
                email,
                name: (typeof name === 'string' && name.trim()) || email.split('@')[0],
                role: 'user', // Role is always assigned server-side
                created_at: new Date(),
                updated_at: new Date()
            });
            await newUser.save();
            return res.status(201).json({
                message: 'User created successfully',
                user: {
                    uid: newUser.uid,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role,
                }
            });
        }
        catch (saveError) {
            if ((0, errors_1.errCode)(saveError) === 11000) {
                const conflictUser = await User_1.default.findOne({ uid });
                if (conflictUser) {
                    return res.status(200).json({
                        message: 'User already exists',
                        user: {
                            uid: conflictUser.uid,
                            email: conflictUser.email,
                            name: conflictUser.name,
                            role: conflictUser.role,
                        }
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
