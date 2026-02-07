
import React, { useState, useEffect } from "react";
import { Borrower, Loan, User } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, ArrowUpDown, Columns3, Filter } from "lucide-react";
import { motion } from "framer-motion";
import BorrowerForm from "../components/borrowers/BorrowerForm";
import ColumnSettingsModal from "../components/borrowers/ColumnSettingsModal";
import FilterModal from "../components/borrowers/FilterModal";
import { format } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";

const employmentColors = {
  employed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  self_employed: "bg-blue-100 text-blue-800 border-blue-200",
  unemployed: "bg-red-100 text-red-800 border-red-200",
  retired: "bg-purple-100 text-purple-800 border-purple-200",
  student: "bg-amber-100 text-amber-800 border-amber-200"
};

export default function Borrowers() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'name', 'email', 'phone', 'employment_status', 'credit_score', 'loans'
  ]);
  const [filters, setFilters] = useState({ employment_status: 'all' });

  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    if (!permissionsLoading) {
      loadData();
      
      const saved = localStorage.getItem('borrowers_visible_columns');
      if (saved) {
        try {
          setVisibleColumns(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse saved columns from localStorage", e);
          setVisibleColumns(['name', 'email', 'phone', 'employment_status', 'credit_score', 'loans']);
        }
      }
    }
  }, [permissionsLoading]);

  const ensureBorrowerContactTypes = async (borrowersData) => {
    const missingType = borrowersData.filter(borrower => !borrower.borrower_type);
    if (missingType.length === 0) {
      return borrowersData;
    }

    try {
      await Promise.all(
        missingType.map(borrower => Borrower.update(borrower.id, { borrower_type: 'individual' }))
      );
      return await Borrower.list('-created_date');
    } catch (error) {
      console.error('Error backfilling borrower contact types:', error);
      return borrowersData;
    }
  };

  const loadData = async () => {
    try {
      const [initialBorrowersData, loansData, usersData] = await Promise.all([
        Borrower.list('-created_date'),
        Loan.list(),
        User.list()
      ]);
      
      const borrowerUsers = usersData.filter(user => user.app_role === 'Borrower');
      const existingBorrowerEmails = initialBorrowersData.map(b => b.email);
      
      for (const user of borrowerUsers) {
        if (user.email && !existingBorrowerEmails.includes(user.email)) {
          try {
            await Borrower.create({
              user_id: user.id,
              first_name: user.first_name || '',
              last_name: user.last_name || '',
              email: user.email,
              borrower_type: 'individual',
            });
          } catch (error) {
            console.error(`Error auto-creating borrower for ${user.email}:`, error);
          }
        }
      }
      
      const updatedBorrowersData = await Borrower.list('-created_date');
      const borrowersWithTypes = await ensureBorrowerContactTypes(updatedBorrowersData);
      
      setAllBorrowers(borrowersWithTypes);
      setAllLoans(loansData);
      setAllUsers(usersData);
    } catch(e) {
      console.log("Failed to load data.", e);
    }
  };

  const handleSubmit = async (borrowerData) => {
    setIsProcessing(true);
    try {
      if (editingBorrower) {
        await Borrower.update(editingBorrower.id, borrowerData);
      } else {
        await Borrower.create(borrowerData);
      }
      setShowForm(false);
      setEditingBorrower(null);
      loadData();
    } catch (error) {
      console.error('Error saving borrower:', error);
    }
    setIsProcessing(false);
  };

  const handleEdit = (borrower) => {
    setEditingBorrower(borrower);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBorrower(null);
  };

  const getBorrowerLoanCount = (borrowerId) => {
    return allLoans.filter(loan => loan.borrower_ids?.includes(borrowerId)).length;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredBorrowers = allBorrowers.filter(borrower => {
    if (!permissions.canManageContacts) {
      return false;
    }
    
    const fullName = `${borrower.first_name} ${borrower.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      borrower.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrower.phone?.includes(searchTerm);
    
    const matchesEmployment = filters.employment_status === 'all' || borrower.employment_status === filters.employment_status;
    
    return matchesSearch && matchesEmployment;
  });

  const sortedBorrowers = [...filteredBorrowers].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === 'name') {
      aValue = `${a.first_name} ${a.last_name}`;
      bValue = `${b.first_name} ${b.last_name}`;
    } else if (sortField === 'loans') {
      aValue = getBorrowerLoanCount(a.id);
      bValue = getBorrowerLoanCount(b.id);
    } else if (sortField === 'created_date' || sortField === 'date_of_birth') {
      aValue = aValue ? new Date(aValue).getTime() : -Infinity;
      bValue = bValue ? new Date(bValue).getTime() : -Infinity;
    }

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  const renderColumnValue = (borrower, columnKey) => {
    switch (columnKey) {
      case 'name':
        return `${borrower.first_name} ${borrower.last_name}`;
      case 'email':
        return borrower.email || '-';
      case 'phone':
        return borrower.phone || '-';
      case 'date_of_birth':
        return borrower.date_of_birth ? format(new Date(borrower.date_of_birth), 'MMM d, yyyy') : '-';
      case 'employment_status':
        return borrower.employment_status ? (
          <Badge className={`${employmentColors[borrower.employment_status]} border font-medium`}>
            {borrower.employment_status.replace('_', ' ')}
          </Badge>
        ) : '-';
      case 'credit_score':
        return borrower.credit_score || '-';
      case 'rehabs_done':
        return borrower.rehabs_done_36_months || '-';
      case 'rentals_owned':
        return borrower.rentals_owned_36_months || '-';
      case 'loans':
        return getBorrowerLoanCount(borrower.id);
      case 'created_date':
        return borrower.created_date ? format(new Date(borrower.created_date), 'MMM d, yyyy') : '-';
      default:
        return '-';
    }
  };

  const getColumnLabel = (columnKey) => {
    const columnConfig = {
      'name': 'Name',
      'email': 'Email',
      'phone': 'Phone',
      'date_of_birth': 'Date of Birth',
      'employment_status': 'Employment',
      'credit_score': 'Credit Score',
      'rehabs_done': 'Rehabs (36mo)',
      'rentals_owned': 'Rentals (36mo)',
      'loans': 'Loans',
      'created_date': 'Added Date'
    };
    return columnConfig[columnKey] || columnKey;
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <BorrowerForm
            borrower={editingBorrower}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
              Borrower Management
            </h1>
            <p className="text-slate-600 text-lg">
              Manage your client database and profiles
            </p>
          </div>
          {permissions.canManageContacts && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Borrower
            </Button>
          )}
        </motion.div>

        {permissions.canManageContacts ? (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-xl font-bold text-slate-900">
                  All Borrowers
                </CardTitle>
                <div className="flex gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search borrowers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowFilterModal(true)}
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowColumnSettings(true)}
                  >
                    <Columns3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-7">
              {sortedBorrowers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.map(columnKey => (
                        <TableHead key={columnKey}>
                          <button
                            onClick={() => handleSort(columnKey)}
                            className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                          >
                            {getColumnLabel(columnKey)}
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBorrowers.map((borrower) => (
                      <TableRow key={borrower.id} className="hover:bg-slate-50">
                        {visibleColumns.map(columnKey => (
                          <TableCell key={columnKey} className={columnKey === 'name' ? 'font-medium' : ''}>
                            {renderColumnValue(borrower, columnKey)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => console.log('View borrower:', borrower)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(borrower)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-500 mb-6">
                    {allBorrowers.length === 0 
                      ? "No borrowers yet. Add your first borrower to get started." 
                      : "No borrowers match your search criteria."}
                  </p>
                  {allBorrowers.length === 0 && (
                    <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Borrower
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <h3 className="text-xl font-semibold text-slate-600 mb-2">Access Denied</h3>
            <p className="text-slate-500 mb-6">You do not have permission to view this page. Please contact your administrator if you believe this is an error.</p>
          </div>
        )}
      </div>

      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        onColumnsChange={(newColumns) => {
          setVisibleColumns(newColumns);
          localStorage.setItem('borrowers_visible_columns', JSON.stringify(newColumns));
        }}
        visibleColumns={visibleColumns}
      />
      
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
}
