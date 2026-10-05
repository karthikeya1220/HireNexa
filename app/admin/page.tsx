"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronRight, Loader2, Users, Server, FileText, Building, Briefcase, Shield, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import UserManagement from "@/components/admin/user-management"
import VendorManagement from "@/components/admin/vendor-management"
import apiClient from "@/lib/api-client"
import { MakeUserAdmin } from "@/components/admin-make-user-admin"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardShell } from "@/components/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard-header"

interface StatsCard {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  uid: string; // Changed from optional to required to match UserData interface
}

export default function AdminPage() {
  const { userProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [dataLoaded, setDataLoaded] = useState(false);
  const router = useRouter();
  const initialCheckRef = useRef(false);

  // Define all hooks first, before any conditional returns
  const fetchStats = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'admin' || isLoadingStats) {
      return;
    }
    
    setIsLoadingStats(true);
    
    try {
      // Fetch users first
      let usersData = [];
      try {
        const response = await apiClient.auth.getAllUsers();
        usersData = Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching users for stats:", error);
        usersData = [];
      }
      
      // Other stats fetching logic...
      const [resumesData, vendorsData, jobsData] = await Promise.allSettled([
        apiClient.resumes.getAllResumes(),
        apiClient.vendors.getAll(),
        apiClient.jobs.getAll()
      ]);

      const resumeCount = resumesData.status === 'fulfilled' ? 
        (Array.isArray(resumesData.value) ? resumesData.value.length : 0) : 0;
      
      const vendorCount = vendorsData.status === 'fulfilled' ? 
        (Array.isArray(vendorsData.value) ? vendorsData.value.length : 0) : 0;
      
      const jobCount = jobsData.status === 'fulfilled' ? 
        (Array.isArray(jobsData.value) ? jobsData.value.length : 0) : 0;

      setApiStatus('online');
      
      const newStats = [
        {
          title: "Total Users",
          value: usersData.length,
          description: "Active user accounts",
          icon: <Users className="h-5 w-5 text-blue-500" />,
        },
        {
          title: "API Status",
          value: "Online",
          description: "System operational",
          icon: <Server className="h-5 w-5 text-green-500" />,
        },
        {
          title: "Total Resumes",
          value: resumeCount,
          description: "Resumes analyzed",
          icon: <FileText className="h-5 w-5 text-purple-500" />,
        },
        {
          title: "Total Vendors",
          value: vendorCount,
          description: "Registered vendors",
          icon: <Building className="h-5 w-5 text-orange-500" />,
        },
        {
          title: "Total Jobs",
          value: jobCount,
          description: "Active job postings",
          icon: <Briefcase className="h-5 w-5 text-indigo-500" />,
        },
      ];
      
      setStats(newStats);
      setDataLoaded(true);
      
    } catch (error) {
      console.error("Error fetching stats:", error);
      setApiStatus('offline');
      
      setStats([
        {
          title: "API Status",
          value: "Offline",
          description: "Connection error",
          icon: <Server className="h-5 w-5 text-red-500" />,
        },
      ]);
      
      toast({
        title: "Failed to load dashboard data",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStats(false);
    }
  }, [userProfile, isLoadingStats, toast]);

  const fetchUsers = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'admin' || isLoadingUsers) {
      return;
    }
    
    setIsLoadingUsers(true);
    try {
      const response = await apiClient.auth.getAllUsers();
      // Ensure response is an array and each user has required properties
      const formattedUsers = Array.isArray(response) ? response.map(user => ({
        id: user.id || user._id || user.uid || '',
        uid: user.uid || user.id || user._id || '',
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'user'
      })) : [];
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Failed to load users",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      });
      // Set empty array to prevent continuous retries
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userProfile, isLoadingUsers, toast]);

  useEffect(() => {
    if (!initialCheckRef.current && userProfile === null) {
      initialCheckRef.current = true;
      refreshUserProfile().catch(error => {
        console.error("Error refreshing profile:", error);
      });
    }
  }, [refreshUserProfile, userProfile]);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    if (activeTab === 'dashboard' && !dataLoaded && !isLoadingStats) {
      fetchStats();
    }
  }, [activeTab, userProfile, dataLoaded, isLoadingStats, fetchStats]);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    // Only fetch users when the tab is "users" and we don't have users yet or explicitly need to refresh
    if (activeTab === 'users' && !isLoadingUsers && users.length === 0) {
      fetchUsers();
    }
  }, [activeTab, userProfile, users.length, isLoadingUsers, fetchUsers]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Now we can do the conditional return
  if (userProfile && userProfile.role !== 'admin') {
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

  return (
    <DashboardShell>
      <DashboardHeader heading="Admin Dashboard" text={`Logged in as: ${userProfile?.email || 'Admin'}`}>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={async () => {
            try {
              await refreshUserProfile();
              toast({
                title: "Profile refreshed",
                description: "User profile has been updated",
              });
            } catch (error) {
              toast({
                title: "Refresh failed",
                description: `${error}`,
                variant: "destructive",
              });
            }
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> 
          Refresh
        </Button>
      </DashboardHeader>

      <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="tools">Admin Tools</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">System Overview</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchStats()} 
              disabled={isLoadingStats}
            >
              {isLoadingStats ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isLoadingStats ? ' Loading...' : ' Refresh'}
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingStats ? (
              // Display skeletons while loading
              Array(5).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-4 w-28" />
                  </CardContent>
                </Card>
              ))
            ) : (
              stats.map((stat, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    {stat.icon}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>System events from the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  {Array(2).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-4">
                      <div>
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="font-medium">System Status</p>
                      <p className="text-sm text-muted-foreground">
                        API {apiStatus === 'online' ? 'online' : 'connection issue'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{new Date().toLocaleTimeString()}</p>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="font-medium">Dashboard Accessed</p>
                      <p className="text-sm text-muted-foreground">Admin user logged in</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{new Date().toLocaleTimeString()}</p>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users and roles</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchUsers()} 
                disabled={isLoadingUsers}
              >
                {isLoadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isLoadingUsers ? ' Loading...' : ' Refresh'}
              </Button>
            </CardHeader>
            <CardContent>
              <UserManagement 
                users={users}
                isLoading={isLoadingUsers}
                onUserUpdated={fetchUsers}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="vendors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>Manage vendor information</CardDescription>
            </CardHeader>
            <CardContent>
              <VendorManagement />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tools" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <MakeUserAdmin />
            
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Environment details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="font-medium">{process.env.NODE_ENV}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API URL:</span>
                    <span className="font-medium">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Status:</span>
                    <span className={`font-medium ${apiStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                      {apiStatus === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
