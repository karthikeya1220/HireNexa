"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUserProfile, userProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // We'll check the admin status when the component mounts
    const checkAdminStatus = async () => {
      if (!loading) {
        if (!user) {
          // Not logged in at all
          router.push('/login?redirect=/admin');
          return;
        }
        
        // Refresh the user profile to get the latest role information
        await refreshUserProfile();
        
        // After refreshing, we'll let the render logic decide what to show
        setIsChecking(false);
      }
    };
    
    checkAdminStatus();
  }, [user, loading, router, refreshUserProfile]);

  if (loading || isChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-lg">Checking permissions...</span>
      </div>
    );
  }

  // If the user is an admin, render the children
  if (userProfile?.role === 'admin') {
    return <>{children}</>;
  }
  
  // If user is logged in but not admin, show the admin request component
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center">
        <div className="inline-block p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
          <Shield className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Admin Access Required</h1>
        <p className="text-muted-foreground mb-8">
          You need administrator privileges to access this page. Contact an
          administrator to have your role upgraded.
        </p>
        
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}