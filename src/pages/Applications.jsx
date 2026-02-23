import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Filter, Columns, Loader2, AlertCircle, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FilterModal from "../components/applications/FilterModal";
import ColumnSettingsModal from "../components/applications/ColumnSettingsModal";
import { getLoanTypeLabel, getStatusLabel, getStatusColor } from "../components/utils/displayHelpers";
import { useToast } from "@/components/ui/use-toast";
import ProductTour from "../components/shared/ProductTour";
import { isUserOnApplicationTeam } from "@/components/utils/teamAccess";

const ITEMS_PER_PAGE = 10;
const STORAGE_KEY = 'loan_applications_visible_columns';

const availableColumns = [
  { key: 'application_number', label: 'Application #', required: true },
  { key: 'borrower_name', label: 'Borrower', required: true },
  { key: 'loan_type', label: 'Loan Type' },
  { key: 'loan_amount', label: 'Loan Amount' },
  { key: 'status', label: 'Status', required: true },
  { key: 'created_date', label: 'Created' },
  { key: 'updated_date', label: 'Last Updated', required: true },
  { key: 'submission_count', label: 'Submissions' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'property_type', label: 'Property Type' },
  { key: 'borrower_email', label: 'Email' },
  { key: 'borrower_phone', label: 'Phone' },
  { key: 'borrower_address_street', label: 'Borrower Address' },
  { key: 'loan_purpose', label: 'Loan Purpose' },
  { key: 'current_step', label: 'Progress' }
];

const getOrdinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatDateColumn = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 7) {
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }
  
  const currentYear = now.getFullYear();
  const dateYear = date.getFullYear();
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;
  
  if (dateYear !== currentYear) {
    return `${formattedDate}, ${dateYear}`;
  }
  
  return formattedDate;
};

export default function Applications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', loan_type: 'all' });
  const [showMyApplications, setShowMyApplications] = useState(false);
  const [sortOption, setSortOption] = useState('recently_created');
  const [currentPage, setCurrentPage] = useState(1);

  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);


  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedKeys = JSON.parse(saved);
      const columnsWithLabels = savedKeys.map(key => {
        const col = availableColumns.find(c => c.key === key);
        return { key, label: col?.label || key };
      });
      setVisibleColumns(columnsWithLabels);
    } else {
      const defaults = ['application_number', 'borrower_name', 'borrower_address_street', 'loan_type', 'status', 'updated_date', 'submission_count'];
      const columnsWithLabels = defaults.map(key => {
        const col = availableColumns.find(c => c.key === key);
        return { key, label: col?.label || key };
      });
      setVisibleColumns(columnsWithLabels);
    }
  }, []);

  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let allApps;
      if (permissions.canViewAnyApplication) {
        // Loan officers and admins need to fetch all applications with elevated permissions
        const response = await base44.functions.invoke('getAllApplications');
        allApps = response.data.applications || [];
      } else {
        allApps = await base44.entities.LoanApplication.list('-created_date');
      }

      let filteredApps = allApps;
      if (permissions.isBorrower) {
        const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];
        if (permissions.isBorrowerLiaison) {
          filteredApps = allApps.filter((app) => isUserOnApplicationTeam(app, currentUser, permissions));
        } else {
          filteredApps = allApps.filter((app) =>
            borrowerAccessIds.includes(app.primary_borrower_id) ||
            app.co_borrowers && app.co_borrowers.some((cb) =>
              borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
            )
          );
        }
      } else if (permissions.isLoanPartner) {
        filteredApps = allApps.filter((app) => isUserOnApplicationTeam(app, currentUser, permissions));
      }

      setApplications(filteredApps);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load applications. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadApplications();
    }
  }, [permissionsLoading, currentUser]);

  const handleSortChange = (option) => {
    setSortOption(option);
    setCurrentPage(1);
  };

  const sortedAndFilteredApplications = applications.
  filter((app) => {
    // Filter by "My Applications" if enabled
    if (showMyApplications && currentUser) {
      const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];
      if (permissions.isLoanOfficer || permissions.isAdministrator || permissions.isPlatformAdmin) {
        // For staff, check if they're the assigned loan officer
        if (app.assigned_loan_officer_id !== currentUser.id) {
          return false;
        }
      } else if (permissions.isBorrower) {
        // For borrowers, check if they're the primary borrower or a co-borrower
        if (permissions.isBorrowerLiaison) {
          if (!isUserOnApplicationTeam(app, currentUser, permissions)) {
            return false;
          }
        } else {
          const isPrimaryBorrower = borrowerAccessIds.includes(app.primary_borrower_id);
          const isCoBorrower = app.co_borrowers && app.co_borrowers.some((cb) =>
            borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
          );
          if (!isPrimaryBorrower && !isCoBorrower) {
            return false;
          }
        }
      } else if (permissions.isLoanPartner) {
        if (!isUserOnApplicationTeam(app, currentUser, permissions)) {
          return false;
        }
      }
    }

    const matchesSearch = !searchTerm ||
    app.application_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.borrower_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.borrower_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.borrower_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filters.status === 'all' || app.status === filters.status;
    const matchesLoanType = filters.loan_type === 'all' || app.loan_type === filters.loan_type;

    return matchesSearch && matchesStatus && matchesLoanType;
  }).
  sort((a, b) => {
    switch (sortOption) {
      case 'recently_created':
        return new Date(b.created_date) - new Date(a.created_date);
      case 'recently_updated':
        return new Date(b.updated_date) - new Date(a.updated_date);
      case 'application_number':
        return (a.application_number || '').localeCompare(b.application_number || '');
      default:
        return new Date(b.created_date) - new Date(a.created_date);
    }
  });

  const totalPages = Math.ceil(sortedAndFilteredApplications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedApplications = sortedAndFilteredApplications.slice(startIndex, endIndex);

  const handleNewApplication = async () => {
    if (!permissions.canCreateApplication) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You do not have permission to create new applications."
      });
      return;
    }
    try {
      const appNumber = `APP-${Date.now()}`;

      const applicationData = {
        application_number: appNumber,
        status: 'draft',
        current_step: 1,
        borrower_type: 'individual',
        has_coborrowers: 'no'
      };

      if (permissions.isBorrower) {
        applicationData.primary_borrower_id = currentUser.id;
      }
      if (permissions.isBroker) {
        applicationData.broker_ids = [currentUser.id].filter(Boolean);
        applicationData.referral_broker = {
          name: [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim() || currentUser.full_name || currentUser.email || 'Broker',
          email: currentUser.email || null,
          phone: currentUser.phone || null,
          user_id: currentUser.id || null
        };
        applicationData.referrer_name = applicationData.referral_broker.name;
      }

      const response = await base44.functions.invoke('createLoanApplication', {
        application_data: applicationData
      });
      const newApp = response?.data?.application || response?.application;
      if (!newApp?.id) {
        throw new Error('Failed to create application.');
      }
      navigate(createPageUrl("NewApplication") + `?id=${newApp.id}`);
    } catch (error) {
      console.error('Error creating application:', error);
      toast({
        variant: "destructive",
        title: "Failed to Create Application",
        description: "An error occurred while creating the application. Please try again."
      });
    }
  };

  const handleViewApplication = (app) => {
    // Borrowers cannot access applications that are 'under_review'
    if (permissions.isBorrower && app.status === 'under_review') {
      return; // Do nothing - row should not be clickable
    }
    const action = app.status === 'draft' || app.status === 'review_completed' ? '' : '&action=view';
    navigate(createPageUrl("NewApplication") + `?id=${app.id}${action}`);
  };

  const renderColumnValue = (app, columnKey) => {
    switch (columnKey) {
      case 'application_number':
        return <span className="font-medium">{app.application_number || 'N/A'}</span>;
      case 'borrower_name':
        return app.borrower_first_name && app.borrower_last_name ?
        `${app.borrower_first_name} ${app.borrower_last_name}` :
        app.borrower_email || 'N/A';
      case 'loan_type':
        return app.loan_type ? getLoanTypeLabel(app.loan_type) : 'N/A';
      case 'status':
        return (
          <Badge className={`${getStatusColor(app.status)} border-0`}>
            {getStatusLabel(app.status)}
          </Badge>);
      case 'loan_amount':
        return app.desired_loan_amount ? `$${app.desired_loan_amount.toLocaleString()}` : 'N/A';
      case 'property_address':
        return app.property_address_street || 'N/A';
      case 'property_type':
        return app.property_type || 'N/A';
      case 'borrower_email':
        return app.borrower_email || 'N/A';
      case 'borrower_phone':
        return app.borrower_phone || 'N/A';
      case 'borrower_address_street':
        return app.borrower_address_street || 'N/A';
      case 'loan_purpose':
        return app.loan_purpose || 'N/A';
      case 'current_step':
        return `Step ${app.current_step || 1}`;
      case 'created_date':
        return formatDateColumn(app.created_date);
      case 'updated_date':
        return formatDateColumn(app.updated_date);
      case 'submission_count':
        const count = app.submission_count || 0;
        return count > 0 ?
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
            {getOrdinal(count)}
          </Badge> :
        <span className="text-slate-500">-</span>;
      default:
        return app[columnKey] || 'N/A';
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Applications</h3>
                  <p className="text-red-700 mb-4">
                    {error.message || 'An error occurred while loading applications. This may be a temporary network issue.'}
                  </p>
                  <Button onClick={() => loadApplications()} variant="outline" className="border-red-300">
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>);
  }

  return (
    <>
      <ProductTour currentUser={currentUser} pageName="Applications" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Loan Applications
          </h1>
          {permissions.canCreateApplication &&
          <Button
            onClick={handleNewApplication}
            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg">

              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          }
        </motion.div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-2xl">All Applications</CardTitle>
              <div className="relative" data-tour="search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />

              </div>
              <div className="flex gap-3 flex-wrap" data-tour="filters">
                {permissions.canViewAnyApplication &&
                <Button
                  variant={showMyApplications ? "default" : "outline"}
                  onClick={() => setShowMyApplications(!showMyApplications)}
                  className={showMyApplications ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>

                    <User className="w-4 h-4 mr-2" />
                    My Applications
                  </Button>
                }
                <Select value={sortOption} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recently_created">Recently Created</SelectItem>
                    <SelectItem value="recently_updated">Recently Updated</SelectItem>
                    <SelectItem value="application_number">Application Number</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setShowFilterModal(true)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={() => setShowColumnModal(true)} data-tour="columns">
                  <Columns className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-7">
            {isLoading ?
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
              </div> :
            sortedAndFilteredApplications.length === 0 ?
            <div className="text-center py-12">
                <p className="text-slate-500 mb-4">No applications found</p>
              </div> :

            <>
                <Table data-tour="actions">
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.map((column) =>
                    <TableHead key={column.key}>
                          {column.label}
                        </TableHead>
                    )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedApplications.map((app) => {
                      const isUnderReviewForBorrower = permissions.isBorrower && app.status === 'under_review';
                      return (
                    <TableRow
                    key={app.id}
                    className={`${isUnderReviewForBorrower ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'}`}
                    onClick={() => handleViewApplication(app)}>

                        {visibleColumns.map((column) =>
                        <TableCell key={column.key} className="px-2 py-4 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                              {renderColumnValue(app, column.key)}
                            </TableCell>
                        )}
                        </TableRow>
                        );
                        })}
                  </TableBody>
                </Table>

                {totalPages > 1 &&
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-slate-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, sortedAndFilteredApplications.length)} of {sortedAndFilteredApplications.length} applications
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}>

                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) =>
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "bg-slate-900 text-white" : ""}>

                            {page}
                          </Button>
                    )}
                      </div>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}>

                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
              }
              </>
            }
          </CardContent>
        </Card>
      </div>

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        onFiltersChange={setFilters} />

      <ColumnSettingsModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        onColumnsChange={setVisibleColumns} />

    </div>
    </>
  );

}
