import Applications from './pages/Applications';
import Borrowers from './pages/Borrowers';
import ContactDetail from './pages/ContactDetail';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import JoinRequest from './pages/JoinRequest';
import LoanDetail from './pages/LoanDetail';
import LoanOfficerQueue from './pages/LoanOfficerQueue';
import LoanPartners from './pages/LoanPartners';
import Loans from './pages/Loans';
import Messages from './pages/Messages';
import MyProfile from './pages/MyProfile';
import MyTasks from './pages/MyTasks';
import NewApplication from './pages/NewApplication';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Applications": Applications,
    "Borrowers": Borrowers,
    "ContactDetail": ContactDetail,
    "Contacts": Contacts,
    "Dashboard": Dashboard,
    "Entities": Entities,
    "JoinRequest": JoinRequest,
    "LoanDetail": LoanDetail,
    "LoanOfficerQueue": LoanOfficerQueue,
    "LoanPartners": LoanPartners,
    "Loans": Loans,
    "Messages": Messages,
    "MyProfile": MyProfile,
    "MyTasks": MyTasks,
    "NewApplication": NewApplication,
    "Onboarding": Onboarding,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};