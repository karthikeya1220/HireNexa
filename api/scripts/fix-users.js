// Script to fix duplicate users in MongoDB
require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectToMongoDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
};

// Define User schema for direct access
const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  email: { type: String, required: true },
  name: { type: String },
  role: { type: String, default: 'user' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Create User model
const User = mongoose.model('User', UserSchema);

// Function to find and fix duplicate users
const fixDuplicateUsers = async () => {
  try {
    // Find all users
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} total users`);

    // Create a map of emails to find duplicates
    const emailMap = new Map();
    const uidMap = new Map();
    const duplicates = [];

    // Find duplicates
    allUsers.forEach(user => {
      if (emailMap.has(user.email)) {
        duplicates.push({ existingUser: emailMap.get(user.email), duplicateUser: user });
      } else {
        emailMap.set(user.email, user);
      }

      if (uidMap.has(user.uid)) {
        duplicates.push({ existingUser: uidMap.get(user.uid), duplicateUser: user });
      } else {
        uidMap.set(user.uid, user);
      }
    });

    console.log(`Found ${duplicates.length} duplicate users`);

    // Handle duplicates
    for (const { existingUser, duplicateUser } of duplicates) {
      console.log(`Processing duplicate: ${duplicateUser.email}`);
      
      // Check which one has admin role
      if (duplicateUser.role === 'admin' && existingUser.role !== 'admin') {
        // If duplicate has admin role, update the existing user and delete duplicate
        console.log(`User ${existingUser.email} - updating to admin role from duplicate`);
        await User.updateOne(
          { _id: existingUser._id },
          { $set: { role: 'admin', updated_at: new Date() } }
        );
        await User.deleteOne({ _id: duplicateUser._id });
      } else {
        // Otherwise, just delete the duplicate
        console.log(`Deleting duplicate user: ${duplicateUser.email}`);
        await User.deleteOne({ _id: duplicateUser._id });
      }
    }

    console.log('Duplicate users fixed!');
  } catch (error) {
    console.error('Error fixing duplicates:', error);
  }
};

// Function to force a user to be admin
const makeUserAdmin = async (email) => {
  try {
    // Find the user by email
    const user = await User.findOne({ email });
    
    if (user) {
      // Update to admin role
      await User.updateOne(
        { email },
        { $set: { role: 'admin', updated_at: new Date() } }
      );
      console.log(`User ${email} has been made admin`);
    } else {
      console.log(`User ${email} not found`);
    }
  } catch (error) {
    console.error(`Error making user admin:`, error);
  }
};

// Main function
const main = async () => {
  // Connect to MongoDB
  const connected = await connectToMongoDB();
  if (!connected) {
    process.exit(1);
  }

  // Fix duplicate users
  await fixDuplicateUsers();

  // Print all users after fixing
  const users = await User.find({});
  console.log('Users after fixing:');
  users.forEach(user => {
    console.log(`- ${user.email} (${user.uid}), role: ${user.role}`);
  });

  // Make specific user admin if needed
  // Uncomment and add email to make admin
  // await makeUserAdmin('your.email@example.com');

  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
};

// Run the script
main(); 