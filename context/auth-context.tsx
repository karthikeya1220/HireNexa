"use client"

import { createContext, useCallback, useContext, useEffect, useState, useRef } from "react"
import { type AuthUser, sessionUser, supabase } from "@/lib/supabase"
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
  user: AuthUser | null;
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
  const [user, setUser] = useState<AuthUser | null>(null)
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
      
      // First try to get the current user profile
      const response = await apiClient.auth.getCurrentUser();
      const userData = response as UserProfile;
      setUserProfile(userData);
      setIsAdmin(userData?.role === 'admin');
    } catch (error) {
      console.error("Error refreshing user profile:", error);
      
      // Only try to create the user if we got a 404 (user doesn't exist yet)
      if ((error as { status?: number }).status === 404) {
        try {
          const userData = {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'User',
          };
          
          // The server derives uid/email from the verified token — only the
          // optional display name travels in the body.
          const response = await apiClient.auth.createFromAuth(userData);
          const result = response as UserProfileResponse;
          
          if (result) {
            setUserProfile(result as unknown as UserProfile);
            setIsAdmin(result.role === 'admin');
          }
        } catch (createError) {
          console.error("Error creating user profile:", createError);
        }
      }
    } finally {
      isRefreshing.current = false;
    }
  }, [user]);

  // Create the users row for a newly signed-in Supabase user (404 path).
  const createUserRecord = async (authUser: AuthUser) => {
    if (!authUser.email) return false;
    
    try {
      const userData = {
        uid: authUser.uid,
        email: authUser.email,
        name: authUser.displayName || authUser.email.split('@')[0] || 'User',
      }
      
      await apiClient.auth.createFromAuth(userData);
      return true;
    } catch (error) {
      console.error("Error creating user record:", error);
      return false;
    }
  }

  // Sync local state + profile for a Supabase auth user (or sign-out).
  const syncAuthUser = useCallback(async (authUser: AuthUser | null) => {
    if (!authUser) {
      setUser(null);
      setUserProfile(null);
      setIsAdmin(false);
      initialLoadAttempted.current = true;
      setLoading(false);
      return;
    }

    setUser(authUser);

    // Clear any previous retry timeout
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
      refreshTimeout.current = null;
    }

    try {
      // Try to get the user profile
      const response = await apiClient.auth.getCurrentUser();
      const userData = response as UserProfileResponse;
      setUserProfile(userData as unknown as UserProfile);
      setIsAdmin(userData?.role === 'admin');
      initialLoadAttempted.current = true;
      setLoading(false);
    } catch (error) {
      console.error("Error fetching user profile:", error);

      // If user doesn't exist in database, create them
      if ((error as { status?: number }).status === 404) {
        try {
          await createUserRecord(authUser);

          // Wait a bit before trying to fetch the user again
          refreshTimeout.current = setTimeout(async () => {
            try {
              const response = await apiClient.auth.getCurrentUser();
              const newUserData = response as UserProfileResponse;
              setUserProfile(newUserData as unknown as UserProfile);
              setIsAdmin(newUserData?.role === 'admin');
            } catch (retryError) {
              console.error("Error on retry:", retryError);
              setUserProfile(null);
              setIsAdmin(false);
            }
          }, 1500);
        } catch (createError) {
          console.error("Error creating user:", createError);
          setUserProfile(null);
          setIsAdmin(false);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }

      if (!initialLoadAttempted.current) {
        initialLoadAttempted.current = true;
        setLoading(false);
      }
    }
  }, []);

  // Handle authentication state changes (fires INITIAL_SESSION immediately,
  // then every SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED event).
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        await syncAuthUser(sessionUser(session));
      }
    );

    return () => {
      isMounted = false;
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
      subscription.unsubscribe();
    };
  }, [syncAuthUser]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, refreshUserProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
