import React, { useState, useEffect, useMemo } from "react";
import { Loan, User } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Settings, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { isUserOnLoanTeam } from "@/components/utils/teamAccess";

import ColumnSettingsModal from "../components/loans/ColumnSettingsModal";
import FilterModal from "../components/loans/FilterModal";
import ProductTour from "../components/shared/ProductTour";

const STORAGE_KEY = 'loans_visible_columns';

const baseColumns = [
  { key: 'loan_number', label: 'Loan Number', required: true },
  { key: 'primary_loan_id', label: 'Primary Loan ID' },
  { key: 'borrower', label: 'Borrower', required: true },
  { key: 'loan_product', label: 'Loan Product' },
  { key: 'status', label: 'Status', required: true },
  { key: 'initial_loan_amount', label: 'Loan Amount' },
  { key: 'interest_rate', label: 'Interest Rate' },
  { key: 'origination_date', label: 'Origination Date' },
  { key: 'maturity_date', label: 'Maturity Date' },
  { key: 'updated_date', label: 'Last Updated', required: true },
  { key: 'created_date', label: 'Created' }
];

const formatColumnLabel = (key) => {
  if (!key) return 'N/A';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const normalizeColumnKeys = (keys = []) =>
  keys.map((key) => (key === 'borrowers' ? 'borrower' : key));

const getDefaultColumnKeys = (isBorrower) => {
  if (isBorrower) {
    return ['loan_number', 'property_address', 'loan_product', 'status', 'initial_loan_amount', 'interest_rate', 'updated_date'];
  }
  return ['loan_number', 'property_address', 'borrower', 'loan_product', 'status', 'initial_loan_amount', 'interest_rate', 'updated_date'];
};

const statusColors = {
  application_submitted: 'bg-blue-100 text-blue-800',
  underwriting: 'bg-purple-100 text-purple-800',
  processing: 'bg-amber-100 text-amber-800',
  on_hold: 'bg-slate-100 text-slate-800',
  preclosed_review: 'bg-sky-100 text-sky-800',
  term_sheet_sent: 'bg-cyan-100 text-cyan-800',
  conditional_approval: 'bg-yellow-100 text-yellow-800',
  final_approval: 'bg-emerald-100 text-emerald-800',
  clear_to_close: 'bg-green-100 text-green-800',
  closing_scheduled: 'bg-teal-100 text-teal-800',
  loan_funded: 'bg-indigo-100 text-indigo-800',
  loan_sold: 'bg-violet-100 text-violet-800',
  in_house_servicing: 'bg-blue-100 text-blue-800',
  draws_underway: 'bg-orange-100 text-orange-800',
  draws_fully_released: 'bg-lime-100 text-lime-800',
  archived: 'bg-gray-100 text-gray-800',
  dead: 'bg-gray-100 text-gray-800'
};

const formatStatusLabel = (status) => {
  if (!status) return 'N/A';
  return status.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

export default function Loans() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [allLoans, setAllLoans] = useState([]);
  const [users, setUsers] = useState([]);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('updated_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [sortOption, setSortOption] = useState('recently_updated');
  const [isLoading, setIsLoading] = useState(false);
  const [showMyLoans, setShowMyLoans] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);


  const [filters, setFilters] = useState({
    status: [],
    loan_product: [],
    searchTerm: ''
  });

  const availableColumns = useMemo(() => {
    const columnsByKey = new Map(baseColumns.map((column) => [column.key, column]));
    const dynamicKeys = new Set();

    allLoans.forEach((loan) => {
      Object.keys(loan || {}).forEach((key) => {
        if (!columnsByKey.has(key)) {
          dynamicKeys.add(key);
        }
      });
    });

    const dynamicColumns = Array.from(dynamicKeys)
      .sort()
      .map((key) => ({
        key,
        label: formatColumnLabel(key)
      }));

    return [...baseColumns, ...dynamicColumns];
  }, [allLoans]);

  const defaultColumnKeys = useMemo(
    () => getDefaultColumnKeys(permissions.isBorrower),
    [permissions.isBorrower]
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedKeys = normalizeColumnKeys(JSON.parse(saved));
      const columnsWithLabels = savedKeys.map(key => {
        const col = availableColumns.find(c => c.key === key);
        return { key, label: col?.label || formatColumnLabel(key) };
      });
      setVisibleColumns(columnsWithLabels);
    } else {
      const columnsWithLabels = defaultColumnKeys.map(key => {
        const col = availableColumns.find(c => c.key === key);
        return { key, label: col?.label || formatColumnLabel(key) };
      });
      setVisibleColumns(columnsWithLabels);
    }
  }, [availableColumns, defaultColumnKeys]);

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadLoans();
    }
  }, [permissionsLoading, currentUser]);

  const loadLoans = async () => {
    setIsLoading(true);
    try {
      let usersData = [];
      try {
        if (permissions.isLoanOfficer || permissions.isAdministrator || permissions.isPlatformAdmin) {
          const usersResponse = await base44.functions.invoke('getAllUsers');
          usersData = usersResponse.data.users || [];
        } else {
          usersData = await User.list();
        }
      } catch (error) {
        console.error('Loans page - Error fetching visible users:', error);
      }

      let loansData;
      if (permissions.canViewAllLoans) {
        // Loan officers and admins need to fetch all loans with elevated permissions
        const response = await base44.functions.invoke('getAllLoans');
        loansData = response.data.loans || [];
      } else {
        // Other users fetch only their accessible loans
        loansData = await Loan.list();
      }

      setAllLoans(loansData);
      setUsers(usersData);

      console.log('Loans page - Total loans loaded:', loansData.length);
    } catch (error) {
      console.error('Error loading loans:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load loans. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoanClick = (loanId) => {
    navigate(createPageUrl(`LoanDetail?id=${loanId}`));
  };

  const handleCreateLoan = async () => {
    if (!permissions.canCreateLoan) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You do not have permission to create loans."
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!currentUser || !currentUser.id) {
        throw new Error("Current user not loaded or user ID is missing.");
      }

      const { data: loanNumberData } = await base44.functions.invoke('generateLoanNumber', {
        loan_product: 'bridge'
      });

      const newLoan = await Loan.create({
        loan_number: loanNumberData.loan_number,
        status: 'application_submitted',
        loan_officer_ids: [currentUser.id]
      });

      navigate(createPageUrl(`LoanDetail?id=${newLoan.id}`));
    } catch (error) {
      console.error('Error creating loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create loan. ${error.message || 'Please try again.'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoanUpdate = async (loanId, updatedData) => {
    try {
      const userName = currentUser.first_name && currentUser.last_name ?
      `${currentUser.first_name} ${currentUser.last_name}` :
      currentUser.full_name || currentUser.email;

      const currentLoan = await Loan.get(loanId);
      const changedFields = [];

      Object.keys(updatedData).forEach((key) => {
        if (JSON.stringify(currentLoan[key]) !== JSON.stringify(updatedData[key])) {
          changedFields.push(key);
        }
      });

      const modificationHistory = currentLoan.modification_history || [];
      modificationHistory.push({
        timestamp: new Date().toISOString(),
        modified_by: currentUser.id,
        modified_by_name: userName,
        description: `Updated ${changedFields.length} field(s): ${changedFields.join(', ')}`,
        fields_changed: changedFields
      });

      await Loan.update(loanId, {
        ...updatedData,
        modification_history: modificationHistory
      });

      toast({
        title: "Loan Updated",
        description: "Loan has been updated successfully."
      });

      loadLoans();
    } catch (error) {
      console.error("Error updating loan:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update loan. Please try again."
      });
    }
  };

  const getBorrowerNames = (borrowerIds) => {
    if (!borrowerIds || borrowerIds.length === 0) return 'N/A';
    const names = borrowerIds.
    map((id) => {
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      }
      return user.full_name || user.email;
    }).
    filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'N/A';
  };

  const handleSortChange = (option) => {
    setSortOption(option);
    switch (option) {
      case 'recently_updated':
        setSortField('updated_date');
        setSortDirection('desc');
        break;
      case 'recently_created':
        setSortField('created_date');
        setSortDirection('desc');
        break;
      case 'loan_amount_high':
        setSortField('initial_loan_amount');
        setSortDirection('desc');
        break;
      case 'loan_amount_low':
        setSortField('initial_loan_amount');
        setSortDirection('asc');
        break;
      case 'loan_number':
        setSortField('loan_number');
        setSortDirection('asc');
        break;
      default:
        setSortField('updated_date');
        setSortDirection('desc');
        break;
    }
  };

  const filteredLoans = allLoans.filter((loan) => {
    if (!currentUser) {
      return false;
    }
    const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];

    if (showMyLoans) {
      let isMyLoan = false;

      if (permissions.isLoanOfficer || permissions.isAdministrator || permissions.isPlatformAdmin) {
        const loanOfficerIds = loan.loan_officer_ids || [];
        isMyLoan = loanOfficerIds.includes(currentUser.id);
      } else if (permissions.isBorrower) {
        if (permissions.isBorrowerLiaison) {
          isMyLoan = isUserOnLoanTeam(loan, currentUser, permissions);
        } else {
          const borrowerIds = loan.borrower_ids || [];
          isMyLoan = borrowerIds.some((id) => borrowerAccessIds.includes(id));
        }
      } else if (permissions.isLoanPartner) {
        isMyLoan = isUserOnLoanTeam(loan, currentUser, permissions);
      }

      if (!isMyLoan) {
        return false;
      }

      if (loan.status === 'archived') {
        return false;
      }
    }

    if (!showMyLoans) {
      if (permissions.canViewAllLoans) {

      } else if (permissions.isBorrower) {
        if (permissions.isBorrowerLiaison) {
          if (!isUserOnLoanTeam(loan, currentUser, permissions)) {
            return false;
          }
        } else {
          const borrowerIds = loan.borrower_ids || [];
          if (!borrowerIds.some((id) => borrowerAccessIds.includes(id))) {
            return false;
          }
        }
      } else if (permissions.isLoanPartner) {
        if (!isUserOnLoanTeam(loan, currentUser, permissions)) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (filters.status.length > 0 && !filters.status.includes(loan.status)) return false;
    if (filters.loan_product.length > 0 && !filters.loan_product.includes(loan.loan_product)) return false;
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        loan.loan_number?.toLowerCase().includes(searchLower) ||
        loan.primary_loan_id?.toLowerCase().includes(searchLower) ||
        loan.borrower_entity_name?.toLowerCase().includes(searchLower) ||
        getBorrowerNames(loan.borrower_ids).toLowerCase().includes(searchLower) ||
        loan.loan_product?.toLowerCase().includes(searchLower) ||
        formatStatusLabel(loan.status).toLowerCase().includes(searchLower));

    }
    return true;
  });

  const sortedLoans = [...filteredLoans].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === 'borrower') {
      aValue = getBorrowerNames(a.borrower_ids);
      bValue = getBorrowerNames(b.borrower_ids);
    }

    if (['created_date', 'updated_date', 'origination_date', 'maturity_date'].includes(sortField)) {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }

    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

    if (typeof aValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  const renderColumnValue = (loan, columnKey) => {
    switch (columnKey) {
      case 'loan_number':
        return loan.loan_number || 'N/A';
      case 'primary_loan_id':
        return loan.primary_loan_id || 'N/A';
      case 'borrower':
        return loan.borrower_entity_name || getBorrowerNames(loan.borrower_ids);
      case 'loan_product':
        if (loan.loan_product === 'dscr') {
          return 'DSCR';
        }
        const productLabel = loan.loan_product?.replace(/_/g, ' ') || 'N/A';
        return productLabel.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
      case 'status':
        return (
          <Badge className={`${statusColors[loan.status]} border-0`}>
            {formatStatusLabel(loan.status)}
          </Badge>);

      case 'initial_loan_amount':
        return loan.initial_loan_amount ? `$${loan.initial_loan_amount.toLocaleString()}` : 'N/A';
      case 'interest_rate':
        return loan.interest_rate ? `${loan.interest_rate}%` : 'N/A';
      case 'origination_date':
        return formatDateColumn(loan.origination_date);
      case 'maturity_date':
        return formatDateColumn(loan.maturity_date);
      case 'updated_date':
        return formatDateColumn(loan.updated_date);
      case 'created_date':
        return formatDateColumn(loan.created_date);
      default:
        return loan[columnKey] || 'N/A';
    }
  };

  // Check if tour should auto-show on first login
  const shouldShowTour = () => {
    if (!currentUser) return false;
    const navTourCompleted = localStorage.getItem(`nav_tour_completed_${currentUser.id}`);
    const pageTourCompleted = localStorage.getItem(`page_tour_Loans_${currentUser.id}`);
    return navTourCompleted !== 'true' && pageTourCompleted !== 'true';
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>);

  }

  return (
    <>
    {shouldShowTour() && <ProductTour currentUser={currentUser} pageName="Loans" />}
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Loans
          </h1>
        </motion.div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search loans..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />

              </div>
              <div className="flex gap-3 flex-wrap">
                {permissions.canViewAllLoans &&
                <Button
                  variant={showMyLoans ? "default" : "outline"}
                  onClick={() => setShowMyLoans(!showMyLoans)}
                  className={showMyLoans ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>

                    <UserIcon className="w-4 h-4 mr-2" />
                    My Loans
                  </Button>
                }
                <Select value={sortOption} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recently_updated">Recently Updated</SelectItem>
                    <SelectItem value="recently_created">Recently Created</SelectItem>
                    <SelectItem value="loan_amount_high">Loan Amount (High)</SelectItem>
                    <SelectItem value="loan_amount_low">Loan Amount (Low)</SelectItem>
                    <SelectItem value="loan_number">Loan Number</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setShowFilters(true)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={() => setShowColumnSettings(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-7">
            {sortedLoans.length > 0 ?
            <Table data-tour="loans-table">
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
                  {sortedLoans.map((loan) =>
                <TableRow
                  key={loan.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleLoanClick(loan.id)}>

                      {visibleColumns.map((column) =>
                  <TableCell key={column.key} className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                          {renderColumnValue(loan, column.key)}
                        </TableCell>
                  )}
                    </TableRow>
                )}
                </TableBody>
              </Table> :

            <div className="text-center py-12">
                <p className="text-slate-500 mb-4">No loans found</p>
              </div>
            }
          </CardContent>
        </Card>
      </div>

      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        onColumnsChange={setVisibleColumns}
        availableColumns={availableColumns}
        defaultColumns={defaultColumnKeys} />

      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters} />

    </div>
    </>);

}
