import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Borrower, BorrowerEntity, LoanPartner } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  ArrowUpDown,
  Columns3,
  Users,
  Building2,
  Briefcase,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import ColumnSettingsModal from "../components/contacts/ColumnSettingsModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BorrowerForm from "../components/borrowers/BorrowerForm";
import EntityForm from "../components/entities/EntityForm";
import LoanPartnerForm from "../components/loan-partners/LoanPartnerForm";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import ProductTour from "../components/shared/ProductTour";

export default function Contacts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();

  const [borrowers, setBorrowers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [partners, setPartners] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const storedColumns = localStorage.getItem('contacts_visible_columns');
      return storedColumns ? JSON.parse(storedColumns) : {
        name: true,
        type: true,
        email: true,
        phone: true,
        created_date: true
      };
    } catch (error) {
      console.error("Failed to parse stored columns from localStorage", error);
      return {
        name: true,
        type: true,
        email: true,
        phone: true,
        created_date: true
      };
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'borrowers';
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContactType, setSelectedContactType] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.search, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadData();
    }
  }, [permissionsLoading, currentUser]);

  const ensureBorrowerContactTypes = async (borrowersData) => {
    const missingType = borrowersData.filter(borrower => !borrower.type && !borrower.borrower_type);
    if (missingType.length === 0) {
      return borrowersData;
    }

    try {
      await Promise.all(
        missingType.map(borrower => Borrower.update(borrower.id, { type: 'individual', borrower_type: 'individual' }))
      );
      return await Borrower.list('-created_date');
    } catch (error) {
      console.error('Error backfilling borrower contact types:', error);
      return borrowersData;
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [borrowersData, entitiesData, partnersData] = await Promise.all([
        Borrower.list('-created_date'),
        BorrowerEntity.list('-created_date'),
        LoanPartner.list('-created_date')
      ]);

      const borrowersWithTypes = await ensureBorrowerContactTypes(borrowersData || []);
      setBorrowers(borrowersWithTypes);
      setEntities(entitiesData || []);
      setPartners(partnersData || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast({
        variant: "destructive",
        title: "Error loading contacts",
        description: "Failed to load contact data. Please try again later.",
      });
    }
    setIsLoading(false);
  };

  const handleViewContact = (contact, type) => {
    navigate(createPageUrl('ContactDetail') + `?id=${contact.id}&type=${type}`);
  };

  const handleColumnsChange = (newColumns) => {
    setVisibleColumns(newColumns);
    localStorage.setItem('contacts_visible_columns', JSON.stringify(newColumns));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filterContacts = (contacts, specificType = null) => {
    if (!searchTerm) return contacts;

    return contacts.filter(contact => {
      const searchLower = searchTerm.toLowerCase();
      const type = specificType || contact._type;

      let matchesSearch = false;
      if (type === 'borrower') {
        matchesSearch = (
          `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.phone?.includes(searchTerm)
        );
      } else if (type === 'entity') {
        matchesSearch = (
          contact.entity_name?.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.phone?.includes(searchTerm)
        );
      } else if (type === 'partner') {
        matchesSearch = (
          contact.name?.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.phone?.includes(searchTerm) ||
          contact.type?.toLowerCase().includes(searchLower)
        );
      } else {
        matchesSearch = (
          (contact.first_name && `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchLower)) ||
          (contact.entity_name && contact.entity_name.toLowerCase().includes(searchLower)) ||
          (contact.name && contact.name.toLowerCase().includes(searchLower)) ||
          (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
          (contact.phone && contact.phone.includes(searchTerm))
        );
      }

      return matchesSearch;
    });
  };

  const sortContacts = (contacts, specificType = null) => {
    return [...contacts].sort((a, b) => {
      let aValue, bValue;
      const typeA = specificType || a._type;
      const typeB = specificType || b._type;

      switch(sortField) {
        case 'name':
          const getName = (c, t) => {
            if (t === 'borrower') return `${c.first_name || ''} ${c.last_name || ''}`.trim();
            if (t === 'entity') return c.entity_name || '';
            if (t === 'partner') return c.name || '';
            return '';
          };
          aValue = getName(a, typeA);
          bValue = getName(b, typeB);
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'created_date':
          aValue = a.created_date ? new Date(a.created_date).getTime() : 0;
          bValue = b.created_date ? new Date(b.created_date).getTime() : 0;
          break;
        default:
          return 0;
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
  };

  const allContactsRaw = [
    ...borrowers.map(b => ({ ...b, _type: 'borrower' })),
    ...entities.map(e => ({ ...e, _type: 'entity' })),
    ...partners.map(p => ({ ...p, _type: 'partner' }))
  ];

  const processedBorrowers = sortContacts(filterContacts(borrowers, 'borrower'), 'borrower');
  const processedEntities = sortContacts(filterContacts(entities, 'entity'), 'entity');
  const processedPartners = sortContacts(filterContacts(partners, 'partner'), 'partner');
  const processedAllContacts = sortContacts(filterContacts(allContactsRaw, null), null);

  const handleAddNew = () => {
    setShowAddModal(true);
  };

  const handleContactTypeSelect = (type) => {
    setSelectedContactType(type);
    setShowAddModal(false);
    setShowContactForm(true);
  };

  const handleFormCancel = () => {
    setShowContactForm(false);
    setSelectedContactType(null);
  };

  const handleFormSubmit = async (formData) => {
    setIsProcessing(true);
    try {
      if (selectedContactType === 'borrower') {
        await Borrower.create(formData);
      } else if (selectedContactType === 'entity') {
        await BorrowerEntity.create(formData);
      } else if (selectedContactType === 'loan_partner') {
        await LoanPartner.create(formData);
      }
      
      toast({
        title: "Contact Created",
        description: "Contact has been created successfully.",
      });
      
      setShowContactForm(false);
      setSelectedContactType(null);
      await loadData();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create contact. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getBorrowerContactTypeValue = (contact) => {
    return contact?.type || contact?.borrower_type || 'individual';
  };

  const formatBorrowerContactType = (value) => {
    const normalized = value || 'individual';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderListView = (contacts, type) => {
    if (contacts.length === 0 && !isLoading) {
      return (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            {type === 'borrower' && <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />}
            {type === 'entity' && <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />}
            {type === 'partner' && <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />}
            {type === null && <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />}
            <p className="text-slate-500 text-lg">No contacts found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.name && (
                  <TableHead>
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors font-semibold"
                    >
                      Name
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                )}
                {visibleColumns.type && <TableHead>Type</TableHead>}
                {visibleColumns.email && (
                  <TableHead>
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors font-semibold"
                    >
                      Email
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                )}
                {visibleColumns.phone && (
                  <TableHead>
                    Phone
                  </TableHead>
                )}
                {visibleColumns.created_date && (
                  <TableHead>
                    <button
                      onClick={() => handleSort('created_date')}
                      className="flex items-center gap-1 hover:text-slate-900 transition-colors font-semibold"
                    >
                      Added
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const contactType = type || contact._type;
                let name, subtitle, email, phone;
                const showNameSubtitle = !type;

                if (contactType === 'borrower') {
                  name = `${contact.first_name} ${contact.last_name}`;
                  subtitle = showNameSubtitle ? 'Borrower' : '';
                  email = contact.email;
                  phone = contact.phone;
                } else if (contactType === 'entity') {
                  name = contact.entity_name;
                  subtitle = showNameSubtitle ? 'Entity' : '';
                  email = contact.email;
                  phone = contact.phone;
                } else if (contactType === 'partner') {
                  name = contact.name;
                  subtitle = showNameSubtitle ? 'Partner' : '';
                  email = contact.email;
                  phone = contact.phone;
                } else {
                  name = 'Unknown';
                  subtitle = 'Unknown Type';
                  email = '';
                  phone = '';
                }

                const typeLabelForTab = () => {
                  if (type === 'borrower') return formatBorrowerContactType(getBorrowerContactTypeValue(contact));
                  if (type === 'entity') return contact.entity_type || 'Entity';
                  if (type === 'partner') return contact.type || 'Partner';
                  return null;
                };

                return (
                  <TableRow
                    key={contact.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleViewContact(contact, contactType)}
                  >
                    {visibleColumns.name && (
                      <TableCell>
                        <div>
                          <p className="font-semibold text-slate-900">{name}</p>
                          {showNameSubtitle && (
                            <p className="text-sm text-slate-500 capitalize">{subtitle}</p>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.type && (
                      <TableCell>
                        {type ? (
                          <Badge className={
                            contactType === 'borrower' ? 'bg-blue-100 text-blue-800' :
                            contactType === 'entity' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-amber-100 text-amber-800'
                          }>
                            {typeLabelForTab()}
                          </Badge>
                        ) : (
                          <Badge className={
                            contactType === 'borrower' ? 'bg-blue-100 text-blue-800' :
                            contactType === 'entity' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-amber-100 text-amber-800'
                          }>
                            {contactType === 'borrower' ? 'Borrower' :
                             contactType === 'entity' ? 'Entity' : 'Partner'}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.email && (
                      <TableCell>
                        {email ? (
                          <a
                            href={`mailto:${email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {email}
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.phone && (
                      <TableCell>
                        {phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="text-slate-700 hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.created_date && (
                      <TableCell>
                        <span className="text-slate-600">
                          {contact.created_date ? format(new Date(contact.created_date), 'MMM d, yyyy') : '-'}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Check if tour should auto-show on first login
  const shouldShowTour = () => {
    if (!currentUser) return false;
    const navTourCompleted = localStorage.getItem(`tour_completed_${currentUser.id}`);
    return navTourCompleted !== 'true';
  };

  // Rule 4, 5, 10: Only admins and loan officers can view contacts page
  if (!permissions.canViewContactsPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">You don't have permission to view contacts.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {shouldShowTour() && <ProductTour currentUser={currentUser} pageName="Contacts" />}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
          >
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Contacts
            </h1>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 min-w-[150px]" data-tour="search-contacts">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border focus-visible:ring-2"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowColumnSettings(true)}
              >
                <Columns3 className="w-4 h-4" />
              </Button>
              {permissions.canManageContacts && (
                <Button data-tour="add-contact" onClick={handleAddNew} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                </Button>
              )}
            </div>
          </motion.div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4" data-tour="contact-tabs">
              <TabsTrigger value="all">All Contacts</TabsTrigger>
              <TabsTrigger value="borrowers">Borrowers</TabsTrigger>
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="partners">Partners</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {renderListView(processedAllContacts, null)}
            </TabsContent>

            <TabsContent value="borrowers" className="mt-6">
              {renderListView(processedBorrowers, 'borrower')}
            </TabsContent>

            <TabsContent value="entities" className="mt-6">
              {renderListView(processedEntities, 'entity')}
            </TabsContent>

            <TabsContent value="partners" className="mt-6">
              {renderListView(processedPartners, 'partner')}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        visibleColumns={visibleColumns}
        onColumnsChange={handleColumnsChange}
      />

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Select the type of contact you want to create
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => handleContactTypeSelect('borrower')}
            >
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Borrower</p>
                <p className="text-sm text-slate-500">Add a new borrower contact</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => handleContactTypeSelect('entity')}
            >
              <Building2 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Entity</p>
                <p className="text-sm text-slate-500">Add a new business entity</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => handleContactTypeSelect('loan_partner')}
            >
              <Briefcase className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Loan Partner</p>
                <p className="text-sm text-slate-500">Add a servicer, title company, or other partner</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showContactForm} onOpenChange={(open) => {
        if (!open) handleFormCancel();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContactType === 'borrower' && 'New Borrower'}
              {selectedContactType === 'entity' && 'New Entity'}
              {selectedContactType === 'loan_partner' && 'New Loan Partner'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedContactType === 'borrower' && (
              <BorrowerForm
                borrower={null}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                isProcessing={isProcessing}
              />
            )}
            {selectedContactType === 'entity' && (
              <EntityForm
                entity={null}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                isProcessing={isProcessing}
              />
            )}
            {selectedContactType === 'loan_partner' && (
              <LoanPartnerForm
                partner={null}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                isProcessing={isProcessing}
                toast={toast}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
