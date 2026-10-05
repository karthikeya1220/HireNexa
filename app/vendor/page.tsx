"use client"

import type React from "react"

import { useState, useEffect, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  MapPin,
  Phone,
  Mail,
  Search,
  Building2,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Edit,
  ArrowUpDown,
  Filter,
  Globe,
  Briefcase,
  Clock,
  ChevronRight,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import apiClient from "@/lib/api-client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Vendor {
  _id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  country: string;
  created_at: Date;
  updated_at?: Date;
  status: "active" | "inactive";
  metadata?: {
    created_by: string;
    created_by_id: string;
    last_modified_by: string;
  }
}

type VendorFormState = Omit<Vendor, "_id" | "created_at" | "updated_at" | "metadata">

type StatusFilterType = "all" | "active" | "inactive";

interface ApiError {
  message: string;
  status?: number;
  code?: string;
  data?: { error?: string };
}

const VendorDetailsSheet = memo(
  ({
    editData,
    setEditData,
    setVendors,
  }: {
    editData: {
      isEditing: boolean
      formState: VendorFormState | null
      selectedVendor: Vendor | null
      isSheetOpen: boolean
    }
    setEditData: React.Dispatch<React.SetStateAction<typeof editData>>
    setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>
  }) => {
    if (!editData.selectedVendor) return null

    const handleEditToggle = () => {
      if (editData.isEditing) {
        setEditData((prev) => ({
          ...prev,
          isEditing: false,
          formState: null,
        }))
      } else {
        setEditData((prev) => ({
          ...prev,
          isEditing: true,
          formState: {
            name: editData.selectedVendor!.name,
            contact_person: editData.selectedVendor!.contact_person,
            email: editData.selectedVendor!.email,
            phone: editData.selectedVendor!.phone,
            address: editData.selectedVendor!.address,
            state: editData.selectedVendor!.state,
            country: editData.selectedVendor!.country,
            status: editData.selectedVendor!.status,
          },
        }))
      }
    }

    const handleInputChange = (field: keyof VendorFormState, value: string) => {
      setEditData((prev) => ({
        ...prev,
        formState: prev.formState
          ? {
              ...prev.formState,
              [field]: value,
            }
          : null,
      }))
    }

    const handleSheetClose = () => {
      // First close the sheet
      setEditData((prev) => ({
        ...prev,
        isSheetOpen: false,
      }))

      // Then reset other states after a small delay
      setTimeout(() => {
        setEditData((prev) => ({
          ...prev,
          isEditing: false,
          formState: null,
          selectedVendor: null,
        }))
      }, 300) // Delay matches the sheet close animation
    }

    const handleSave = async () => {
      if (!editData.selectedVendor || !editData.formState) return

      try {
        // Persist the edit — this previously only updated local state and
        // toasted success without ever calling the API.
        const updated = (await apiClient.vendors.update(
          editData.selectedVendor._id,
          editData.formState
        )) as Vendor

        // Update local state with the server's response
        setVendors((prevVendors) =>
          prevVendors.map((vendor) =>
            vendor._id === editData.selectedVendor?._id
              ? { ...vendor, ...updated }
              : vendor,
          )
        )

        toast.success("Vendor updated successfully");

        // Reset edit state
        setEditData((prev) => ({
          ...prev,
          isEditing: false,
          formState: null,
          isSheetOpen: false,
          selectedVendor: null,
        }))
      } catch (error) {
        console.error("Error updating vendor:", error)
        const apiError = error as ApiError
        toast.error(apiError?.data?.error || "Failed to update vendor")
      }
    }

    // Get initials for avatar
    const getInitials = (name: string) => {
      return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    }

    return (
      <Sheet open={editData.isSheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
          <SheetHeader className="mb-6 space-y-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {getInitials(editData.selectedVendor.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <SheetTitle className="text-2xl font-bold">
                  {editData.isEditing ? (
                    <Input
                      value={editData.formState?.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="text-2xl font-bold"
                    />
                  ) : (
                    editData.selectedVendor.name
                  )}
                </SheetTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={editData.selectedVendor.status === "active" ? "outline" : "secondary"}
                    className={`${
                      editData.selectedVendor.status === "active"
                        ? "bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
                        : "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
                    } 
                      dark:bg-background dark:border-border`}
                  >
                    {editData.selectedVendor.status === "active" ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    {editData.selectedVendor.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ID: {editData.selectedVendor._id.substring(0, 8)}
                  </span>
                </div>
              </div>
            </div>
            <Separator />
          </SheetHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              {editData.isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_person" className="text-sm font-medium">
                        Contact Person
                      </Label>
                      <Input
                        id="contact_person"
                        value={editData.formState?.contact_person}
                        onChange={(e) => handleInputChange("contact_person", e.target.value)}
                        className="border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={editData.formState?.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        value={editData.formState?.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-sm font-medium">
                        Status
                      </Label>
                      <Select
                        value={editData.formState?.status}
                        onValueChange={(value) => handleInputChange("status", value as "active" | "inactive")}
                      >
                        <SelectTrigger className="border-border/60">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Address
                    </Label>
                    <Input
                      id="address"
                      value={editData.formState?.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="border-border/60"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-sm font-medium">
                        State
                      </Label>
                      <Input
                        id="state"
                        value={editData.formState?.state}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                        className="border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-sm font-medium">
                        Country
                      </Label>
                      <Input
                        id="country"
                        value={editData.formState?.country}
                        onChange={(e) => handleInputChange("country", e.target.value)}
                        className="border-border/60"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                          <User className="w-4 h-4 mr-2 text-primary/70" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Contact Person</p>
                          <p className="font-medium">{editData.selectedVendor.contact_person}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                            <p>{editData.selectedVendor.email}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                            <p>{editData.selectedVendor.phone}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center">
                          <Globe className="w-4 h-4 mr-2 text-primary/70" />
                          Location
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Address</p>
                          <div className="flex items-start">
                            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-muted-foreground" />
                            <p className="font-medium">{editData.selectedVendor.address || "Not provided"}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Region</p>
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                            <p>
                              {editData.selectedVendor.state}, {editData.selectedVendor.country}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-primary/70" />
                        Business Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between py-2 border-b border-border/30">
                        <span className="text-sm">Vendor Status</span>
                        <Badge
                          variant={editData.selectedVendor.status === "active" ? "outline" : "secondary"}
                          className={`${
                            editData.selectedVendor.status === "active"
                              ? "bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
                              : "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
                          } 
                            dark:bg-background dark:border-border`}
                        >
                          {editData.selectedVendor.status === "active" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {editData.selectedVendor.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border/30">
                        <span className="text-sm">Vendor ID</span>
                        <span className="text-sm font-mono">{editData.selectedVendor._id.substring(0, 12)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm">Created</span>
                        <span className="text-sm">{new Date(editData.selectedVendor.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary/70" />
                    Vendor History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <div className="relative pl-6 pb-8 pt-2 before:absolute before:left-2 before:top-3 before:h-[calc(100%-24px)] before:w-[1px] before:bg-border">
                    <div className="absolute left-0 top-2.5 h-4 w-4 rounded-full border border-primary bg-primary/20"></div>
                    <div className="space-y-1">
                      <p className="font-medium">Vendor Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(editData.selectedVendor.created_at).toLocaleDateString()} at{" "}
                        {new Date(editData.selectedVendor.created_at).toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        By {editData.selectedVendor.metadata?.created_by || "Unknown"}
                      </p>
                    </div>
                  </div>

                  <div className="relative pl-6 pt-2">
                    <div className="absolute left-0 top-2.5 h-4 w-4 rounded-full border border-primary bg-primary/20"></div>
                    <div className="space-y-1">
                      <p className="font-medium">Last Modified</p>
                      <p className="text-sm text-muted-foreground">
                        By {editData.selectedVendor.metadata?.last_modified_by || "Not modified yet"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                    <Clock className="w-10 h-10 mb-2 opacity-20" />
                    <p>Activity history will be available soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-8 gap-2">
            {editData.isEditing ? (
              <>
                <Button variant="outline" onClick={handleEditToggle} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="flex-1 bg-primary">
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={handleEditToggle} className="w-full bg-primary hover:bg-primary/90">
                <Edit className="w-4 h-4 mr-2" />
                Edit Vendor
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  },
)

VendorDetailsSheet.displayName = "VendorDetailsSheet"

// Helper function to get initials
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export default function VendorPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { user } = useAuth()
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "date" | "status">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all")
  const [editData, setEditData] = useState({
    isEditing: false,
    formState: null as VendorFormState | null,
    selectedVendor: null as Vendor | null,
    isSheetOpen: false,
  })

  useEffect(() => {
    const fetchVendors = async () => {
      if (!user) {
        // Stop the spinner instead of returning early (see job/page.tsx).
        setIsLoading(false);
        return
      }

      try {
        const fetchedVendors = await apiClient.vendors.getAll() as Vendor[];
        
        // Transform response to match component's expected format
        const formattedVendors = fetchedVendors.map(vendor => ({
          ...vendor,
          created_at: new Date(vendor.created_at),
          updated_at: vendor.updated_at ? new Date(vendor.updated_at) : undefined
        }));
        
        setVendors(formattedVendors);
      } catch (error: unknown) {
        // Type guard for different error types
        const errorMessage = error instanceof Error 
          ? error.message 
          : (error as ApiError)?.message || "An unexpected error occurred";

        console.error("Error fetching vendors:", error);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVendors();
  }, [user])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  const handleVendorClick = (vendor: Vendor) => {
    setEditData((prev) => ({
      ...prev,
      selectedVendor: vendor,
      isSheetOpen: true,
    }))
  }

  const handleSort = (type: "name" | "date" | "status") => {
    if (sortBy === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(type)
      setSortOrder("asc")
    }
  }

  const filteredVendors = vendors
    .filter((vendor) => {
      // Apply status filter
      if (statusFilter !== "all" && vendor.status !== statusFilter) {
        return false
      }

      // Apply search filter
      return (
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === "name") {
        return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      } else if (sortBy === "date") {
        return sortOrder === "asc"
          ? a.created_at.getTime() - b.created_at.getTime()
          : b.created_at.getTime() - a.created_at.getTime()
      } else {
        // status
        const statusOrder = { active: 1, inactive: 2 }
        const aValue = statusOrder[a.status] || 0
        const bValue = statusOrder[b.status] || 0
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue
      }
    })

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <DashboardSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <motion.div
        className="flex-1 min-h-screen relative"
        initial={false}
        animate={{
          marginLeft: isMobile ? 0 : isSidebarOpen ? "16rem" : "4.5rem",
          width: isMobile ? "100%" : isSidebarOpen ? "calc(100% - 16rem)" : "calc(100% - 4.5rem)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="container mx-auto py-8 px-4 md:px-6">
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Vendor Management
                </h1>
                <p className="text-muted-foreground">Manage your vendor relationships and partnerships</p>
              </div>
              <Button
                onClick={() => router.push("/create-vendor")}
                className="flex items-center w-full md:w-auto bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Vendor
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search Bar */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search vendors by name, contact person, email, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-border/60 bg-background/50 backdrop-blur-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(value: StatusFilterType) => setStatusFilter(value)}>
                  <SelectTrigger className="w-full border-border/60 bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center">
                      <Filter className="w-4 h-4 mr-2 text-primary/70" />
                      <SelectValue placeholder="Filter by status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center border-border/60 bg-background/50 backdrop-blur-sm"
                    >
                      <ArrowUpDown className="w-4 h-4 mr-2 text-primary/70" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSort("name")}>
                      Sort by Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSort("date")}>
                      Sort by Date {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSort("status")}>
                      Sort by Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {isLoading ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              animate="show"
              variants={containerVariants}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <motion.div key={i} variants={itemVariants}>
                  <Card className="overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm">
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                        <div className="space-y-2 flex-1">
                          <div className="h-5 bg-muted rounded-md animate-pulse w-3/4" />
                          <div className="h-4 bg-muted rounded-md animate-pulse w-1/2" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded-md animate-pulse w-full" />
                        <div className="h-4 bg-muted rounded-md animate-pulse w-5/6" />
                        <div className="h-4 bg-muted rounded-md animate-pulse w-4/6" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : filteredVendors.length === 0 ? (
            <Card className="w-full border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Building2 className="w-12 h-12 text-primary/70" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery || statusFilter !== "all" ? "No matching vendors found" : "No Vendors Found"}
                </h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Start by adding your first vendor to manage your business relationships"}
                </p>
                <Button
                  onClick={() => router.push("/create-vendor")}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Vendor
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              animate="show"
              variants={containerVariants}
            >
              <AnimatePresence>
                {filteredVendors.map((vendor) => (
                  <motion.div key={vendor._id} variants={itemVariants} layout>
                    <Card
                      className="overflow-hidden border-border/40 hover:border-primary/60 cursor-pointer transition-all duration-300 bg-card/50 backdrop-blur-sm hover:shadow-md hover:shadow-primary/5"
                      onClick={() => handleVendorClick(vendor)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-primary/10">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(vendor.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">{vendor.name}</CardTitle>
                              <CardDescription>{vendor.contact_person}</CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant={vendor.status === "active" ? "outline" : "secondary"}
                            className={`${
                              vendor.status === "active"
                                ? "bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
                                : "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
                            } 
                              dark:bg-background dark:border-border`}
                          >
                            {vendor.status === "active" ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {vendor.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <Mail className="w-4 h-4 mr-2 flex-shrink-0 text-primary/50" />
                            <span className="truncate">{vendor.email}</span>
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <Phone className="w-4 h-4 mr-2 flex-shrink-0 text-primary/50" />
                            <span>{vendor.phone}</span>
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <MapPin className="w-4 h-4 mr-2 flex-shrink-0 text-primary/50" />
                            <span>
                              {vendor.state}, {vendor.country}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-2 text-xs text-muted-foreground border-t border-border/30 mt-2 flex justify-between">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Added {new Date(vendor.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-primary/70 font-medium">
                          View Details
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
        <VendorDetailsSheet
          editData={editData}
          setEditData={setEditData}
          setVendors={setVendors}
        />
      </motion.div>
    </div>
  )
}

