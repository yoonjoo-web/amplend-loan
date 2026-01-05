
import React, { useState, useEffect } from "react";
import { LoanPartner } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Edit, Columns3, Filter, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import LoanPartnerForm from "../components/loan-partners/LoanPartnerForm";
import ColumnSettingsModal from "../components/loan-partners/ColumnSettingsModal";
import FilterModal from "../components/loan-partners/FilterModal";
import { usePermissions } from "@/components/hooks/usePermissions";

const typeColors = {
  "Servicer": "bg-blue-100 text-blue-800",
  "Auditor": "bg-purple-100 text-purple-800",
  "Referral Partner": "bg-emerald-100 text-emerald-800",
  "Brokerage": "bg-amber-100 text-amber-800",
  "Title Company": "bg-pink-100 text-pink-800",
  "Appraisal Firm": "bg-indigo-100 text-indigo-800",
  "Legal Counsel": "bg-slate-100 text-slate-800",
  "Insurance Provider": "bg-cyan-100 text-cyan-800",
  "Other": "bg-gray-100 text-gray-800"
};

export default function LoanPartners() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [allPartners, setAllPartners] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'name', 'type', 'contact_person', 'email', 'phone', 'created_date'
  ]);
  const [filters, setFilters] = useState({ type: 'all' });

  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    if (!permissionsLoading) {
      loadData();
      
      const savedColumns = localStorage.getItem('loan_partners_visible_columns');
      if (savedColumns) {
        try {
          const parsedColumns = JSON.parse(savedColumns);
          if (Array.isArray(parsedColumns)) {
            setVisibleColumns(parsedColumns);
          }
        } catch (e) {
          console.error("Failed to parse saved columns from localStorage:", e);
          setVisibleColumns(['name', 'type', 'contact_person', 'email', 'phone', 'created_date']);
        }
      }
    }
  }, [permissionsLoading]);

  const loadData = async () => {
    try {
      const partnersData = await LoanPartner.list('-created_date');
      setAllPartners(partnersData);
    } catch(e) {
      console.log("Failed to load data.", e);
    }
  };

  const handleSubmit = async (partnerData) => {
    setIsProcessing(true);
    try {
      if (editingPartner) {
        await LoanPartner.update(editingPartner.id, partnerData);
      } else {
        await LoanPartner.create(partnerData);
      }
      setShowForm(false);
      setEditingPartner(null);
      loadData();
    } catch (error) {
      console.error('Error saving loan partner:', error);
    }
    setIsProcessing(false);
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPartner(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredPartners = allPartners.filter(partner => {
    const matchesSearch = 
      partner.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === 'all' || partner.type === filters.type;
    
    return matchesSearch && matchesType;
  });

  const sortedPartners = [...filteredPartners].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  const columnConfig = {
    'name': 'Name',
    'type': 'Type',
    'contact_person': 'Contact Person',
    'email': 'Email',
    'phone': 'Phone',
    'address': 'Address',
    'website': 'Website',
    'created_date': 'Created On'
  };

  const allAvailableColumns = Object.keys(columnConfig).map(key => ({
    key: key,
    label: columnConfig[key]
  }));

  const renderColumnValue = (partner, columnKey) => {
    switch (columnKey) {
      case 'name':
        return partner.name;
      case 'type':
        return (
          <Badge className={`${typeColors[partner.type] || typeColors['Other']} font-medium`}>
            {partner.type}
          </Badge>
        );
      case 'contact_person':
        return partner.contact_person || '-';
      case 'email':
        return partner.email || '-';
      case 'phone':
        return partner.phone || '-';
      case 'address':
        const addressParts = [
          partner.address_street,
          partner.address_city,
          partner.address_state,
          partner.address_zip
        ].filter(Boolean);
        return addressParts.length > 0 ? addressParts.join(', ') : '-';
      case 'website':
        return partner.website ? (
          <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {partner.website}
          </a>
        ) : '-';
      case 'created_date':
        return partner.created_date ? new Date(partner.created_date).toLocaleDateString() : '-';
      default:
        return partner[columnKey] || '-';
    }
  };

  const getColumnLabel = (columnKey) => {
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
          <LoanPartnerForm
            partner={editingPartner}
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
              Loan Partners
            </h1>
            <p className="text-slate-600 text-lg">
              Manage servicers, auditors, referrers, and other contacts
            </p>
          </div>
          {permissions.canManageContacts && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Partner
            </Button>
          )}
        </motion.div>

        {permissions.canManageContacts ? (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-xl font-bold text-slate-900">
                  All Partners
                </CardTitle>
                <div className="flex gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search partners..."
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
              {sortedPartners.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.map(columnKey => (
                        <TableHead key={columnKey}>
                          <button
                            onClick={() => handleSort(columnKey)}
                            className="flex items-center gap-1 hover:text-slate-900 transition-colors group"
                          >
                            {getColumnLabel(columnKey)}
                            <span className="relative w-4 h-4">
                              {sortField === columnKey ? (
                                <ArrowUpDown
                                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 transition-transform duration-200 ${
                                    sortDirection === 'desc' ? 'rotate-180' : ''
                                  }`}
                                />
                              ) : (
                                <ArrowUpDown
                                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                />
                              )}
                            </span>
                          </button>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPartners.map((partner) => (
                      <TableRow key={partner.id} className="hover:bg-slate-50">
                        {visibleColumns.map(columnKey => (
                          <TableCell key={columnKey} className={columnKey === 'name' ? 'font-medium' : ''}>
                            {renderColumnValue(partner, columnKey)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => console.log('View partner:', partner)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(partner)}
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
                    {allPartners.length === 0 
                      ? "No partners yet. Add your first loan partner to get started." 
                      : "No partners match your search criteria."}
                  </p>
                  {allPartners.length === 0 && (
                    <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Partner
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <h3 className="text-xl font-semibold text-slate-600 mb-2">Access Denied</h3>
            <p className="text-slate-500 mb-6">You do not have permission to view this page.</p>
          </div>
        )}
      </div>

      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        allColumns={allAvailableColumns}
        currentVisibleColumns={visibleColumns}
        onColumnsChange={(newColumns) => {
          setVisibleColumns(newColumns);
          localStorage.setItem('loan_partners_visible_columns', JSON.stringify(newColumns));
        }}
      />
      
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        currentFilters={filters}
        filterOptions={[
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            options: [{ value: 'all', label: 'All Types' }, ...Object.keys(typeColors).map(type => ({ value: type, label: type }))]
          }
        ]}
        onFiltersChange={setFilters}
      />
    </div>
  );
}
