"use client"

import { createContext, useCallback, useContext, useEffect, useState, useRef } from "react"
import { User } from "firebase/auth"
import { auth } from "@/FirebaseConfig"
import type { UserProfile } from "@/types/user"
import apiClient from "@/lib/api-client"

// Define an interface for API responses to fix type issues
interface UserProfileResponse {
  uid: string;
  email: string;
  role: string;
  [key: string]: unknown; // Allow other properties
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  refreshUserProfile: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const initialLoadAttempted = useRef(false)
  const refreshTimeout = useRef<NodeJS.Timeout | null>(null)
  // In-flight guard kept in a ref (not state) so refreshUserProfile keeps a
  // stable identity — consumers that depend on it no longer re-run in a loop.
  const isRefreshing = useRef(false)

  // Function to refresh user profile data - prevent infinite refresh calls
  const refreshUserProfile = useCallback(async () => {
    if (!user || isRefreshing.current) return;
    
    try {
      isRefreshing.current = true;
      console.log("Starting user profile refresh for:", user.uid);
      
      // First try to get the current user profile
      const response = await apiClient.auth.getCurrentUser();
      const userData = response as UserProfile;
      setUserProfile(userData);
      const hasAdminRole = userData?.role === 'admin';
      setIsAdmin(hasAdminRole);
      console.log("User profile refreshed:", {
        uid: userData?.uid,
        email: userData?.email,
        role: userData?.role,
        isAdmin: hasAdminRole
      });
      
      // This is helpful to check if admin rights are propagating correctly
      if (hasAdminRole) {
        console.log("🔑 User has ADMIN privileges");
      } else {
        console.log("User has regular privileges (non-admin)");
      }
    } catch (error) {
      console.error("Error refreshing user profile:", error);
      
      // Only try to create the user if we got a 404 (user doesn't exist yet)
      if ((error as { status?: number }).status === 404) {
        try {
          console.log("Creating user profile after 404");
          const userData = {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'User',
          };
          
          // Create the user via API without requiring authentication
          const response = await apiClient.auth.createFromAuth(userData);
          const result = response as UserProfileResponse;
          console.log("User record created:", result);
          
          if (result) {
            setUserProfile(result as unknown as UserProfile);
            const hasAdminRole = result.role === 'admin';
            setIsAdmin(hasAdminRole);
            console.log("Created user admin status:", hasAdminRole);
          }
        } catch (createError) {
          console.error("Error creating user profile:", createError);
        }
      }
    } finally {
      isRefreshing.current = false;
    }
  }, [user]);

  // Function to create a new user record based on Firebase auth
  const createUserRecord = async (firebaseUser: User) => {
    if (!firebaseUser.email) return false;
    
    try {
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
      }
      
      const response = await apiClient.auth.createFromAuth(userData);
      const result = response as UserProfileResponse;
      console.log("User record created from Firebase auth:", result);
      return true;
    } catch (error) {
      console.error("Error creating user record:", error);
      return false;
    }
  }

  // Handle authentication state changes
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (!isMounted) return;
      
      setUser(authUser);
      
      if (authUser) {
        // Clear any previous timeout
        if (refreshTimeout.current) {
          clearTimeout(refreshTimeout.current);
          refreshTimeout.current = null;
        }
        
        try {
          // Try to get the user profile
          const response = await apiClient.auth.getCurrentUser();
          const userData = response as UserProfileResponse;
          if (isMounted) {
            setUserProfile(userData as unknown as UserProfile);
            setIsAdmin(userData?.role === 'admin');
            initialLoadAttempted.current = true;
            setLoading(false);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          
          // If user doesn't exist in database, create them
          if ((error as { status?: number }).status === 404) {
            try {
              await createUserRecord(authUser);
              
              // Wait a bit before trying to fetch the user again
              refreshTimeout.current = setTimeout(async () => {
                if (!isMounted) return;
                
                try {
                  const response = await apiClient.auth.getCurrentUser();
                  const newUserData = response as UserProfileResponse;
                  if (isMounted) {
                    setUserProfile(newUserData as unknown as UserProfile);
                    setIsAdmin(newUserData?.role === 'admin');
                  }
                } catch (retryError) {
                  console.error("Error on retry:", retryError);
                  if (isMounted) {
                    setUserProfile(null);
                    setIsAdmin(false);
                  }
                }
              }, 1500);
            } catch (createError) {
              console.error("Error creating user:", createError);
              if (isMounted) {
                setUserProfile(null);
                setIsAdmin(false);
              }
            }
          } else {
            if (isMounted) {
              setUserProfile(null);
              setIsAdmin(false);
            }
          }
          
          if (isMounted && !initialLoadAttempted.current) {
            initialLoadAttempted.current = true;
            setLoading(false);
          }
        }
      } else {
        if (isMounted) {
          setUserProfile(null);
          setIsAdmin(false);
          initialLoadAttempted.current = true;
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, refreshUserProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);