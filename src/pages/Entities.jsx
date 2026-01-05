
import React, { useState, useEffect } from "react";
import { BorrowerEntity, Borrower } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Edit, Columns3, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";
import EntityForm from "../components/entities/EntityForm";
import ColumnSettingsModal from "../components/entities/ColumnSettingsModal";
import { usePermissions } from "@/components/hooks/usePermissions";

export default function Entities() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();

  const [allEntities, setAllEntities] = useState([]);
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([
    'entity_name', 'entity_type', 'registration_number', 'email', 'owners'
  ]);
  const [sortField, setSortField] = useState('entity_name'); // Default sort by entity_name
  const [sortDirection, setSortDirection] = useState('asc'); // Default sort ascending

  useEffect(() => {
    if (!permissionsLoading) {
      loadData();
      
      // Load visible columns from local storage
      const saved = localStorage.getItem('entities_visible_columns');
      if (saved) {
        setVisibleColumns(JSON.parse(saved));
      }
    }
  }, [permissionsLoading]);

  const loadData = async () => {
    try {
      const [entitiesData, borrowersData] = await Promise.all([
        BorrowerEntity.list('-created_date'),
        Borrower.list()
      ]);
      
      setAllEntities(entitiesData);
      setAllBorrowers(borrowersData);
    } catch(e) {
      console.log("Failed to load data.", e);
    }
  };

  const handleSubmit = async (entityData) => {
    setIsProcessing(true);
    try {
      if (editingEntity) {
        await BorrowerEntity.update(editingEntity.id, entityData);
      } else {
        await BorrowerEntity.create(entityData);
      }
      setShowForm(false);
      setEditingEntity(null);
      loadData();
    } catch (error) {
      console.error('Error saving entity:', error);
    }
    setIsProcessing(false);
  };

  const handleEdit = (entity) => {
    setEditingEntity(entity);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntity(null);
  };

  const getOwnerNames = (entity) => {
    if (!entity.ownership_structure || entity.ownership_structure.length === 0) {
      return "No owners";
    }
    
    return entity.ownership_structure
      .map(owner => {
        const borrower = allBorrowers.find(b => b.id === owner.borrower_id);
        return borrower ? `${borrower.first_name} ${borrower.last_name} (${owner.ownership_percentage}%)` : owner.owner_name;
      })
      .filter(Boolean)
      .join(', ');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredEntities = allEntities.filter(entity => {
    if (!permissions.canManageContacts) {
      const isOwner = entity.ownership_structure?.some(owner => {
        const borrower = allBorrowers.find(b => b.id === owner.borrower_id);
        return borrower?.user_id === currentUser?.id;
      });
      if (!isOwner) return false;
    }
    
    const matchesSearch = 
      entity.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.address_street?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.address_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getOwnerNames(entity).toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Sort the filtered entities
  const sortedEntities = [...filteredEntities].sort((a, b) => {
    let aValue;
    let bValue;

    // Handle special cases for column values
    switch (sortField) {
      case 'owners':
        aValue = getOwnerNames(a);
        bValue = getOwnerNames(b);
        break;
      case 'address':
        aValue = [a.address_street, a.address_city, a.address_state, a.address_zip].filter(Boolean).join(', ');
        bValue = [b.address_street, b.address_city, b.address_state, b.address_zip].filter(Boolean).join(', ');
        break;
      default:
        aValue = a[sortField];
        bValue = b[sortField];
    }
    
    // Handle null/undefined values by pushing them to the end
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1; // a is null, b is not - a goes after b
    if (bValue == null) return -1; // b is null, a is not - b goes after a

    // Convert to string for consistent comparison if needed, or handle numbers
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      // Fallback for mixed types or other cases, convert to string
      comparison = String(aValue).localeCompare(String(bValue));
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const renderColumnValue = (entity, columnKey) => {
    switch (columnKey) {
      case 'entity_name':
        return entity.entity_name;
      case 'entity_type':
        return entity.entity_type || '-';
      case 'registration_number':
        return entity.registration_number || '-';
      case 'email':
        return entity.email || '-';
      case 'phone':
        return entity.phone || '-';
      case 'address':
        const addressParts = [
          entity.address_street,
          entity.address_city,
          entity.address_state,
          entity.address_zip
        ].filter(Boolean);
        return addressParts.length > 0 ? addressParts.join(', ') : '-';
      case 'owners':
        return getOwnerNames(entity);
      default:
        return '-';
    }
  };

  const getColumnLabel = (columnKey) => {
    const columnConfig = {
      'entity_name': 'Entity Name',
      'entity_type': 'Type',
      'registration_number': 'EIN',
      'email': 'Email',
      'phone': 'Phone',
      'address': 'Address',
      'owners': 'Owners'
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
          <EntityForm
            entity={editingEntity}
            borrowers={allBorrowers}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isProcessing={isProcessing}
            currentUser={currentUser}
            canManage={permissions.canManageContacts}
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
              Borrower Entities
            </h1>
            <p className="text-slate-600 text-lg">
              Manage companies and entities owned by borrowers
            </p>
          </div>
          {permissions.canManageContacts && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Entity
            </Button>
          )}
        </motion.div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-xl font-bold text-slate-900">
                All Entities
              </CardTitle>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowColumnSettings(true)}
                  aria-label="Column Settings"
                >
                  <Columns3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-7">
            {sortedEntities.length > 0 ? (
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
                          {sortField === columnKey ? (
                            sortDirection === 'asc' ? (
                              <ArrowUpDown className="w-3 h-3 rotate-180" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-25" />
                          )}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntities.map((entity) => (
                    <TableRow key={entity.id} className="hover:bg-slate-50">
                      {visibleColumns.map(columnKey => (
                        <TableCell key={columnKey} className={columnKey === 'entity_name' ? 'font-medium' : ''}>
                          {renderColumnValue(entity, columnKey)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => console.log('View entity:', entity)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          {permissions.canManageContacts && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(entity)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-6">
                  {allEntities.length === 0 
                    ? "No entities yet. Add your first entity to get started." 
                    : "No entities match your search criteria."}
                </p>
                {allEntities.length === 0 && permissions.canManageContacts && (
                  <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Entity
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        availableColumns={[ // Define all possible columns that can be shown/hidden
          { key: 'entity_name', label: 'Entity Name' },
          { key: 'entity_type', label: 'Type' },
          { key: 'registration_number', label: 'EIN' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'address', label: 'Address' },
          { key: 'owners', label: 'Owners' },
        ]}
        visibleColumns={visibleColumns}
        onColumnsChange={(newColumns) => {
          setVisibleColumns(newColumns);
          localStorage.setItem('entities_visible_columns', JSON.stringify(newColumns));
        }}
      />
    </div>
  );
}
