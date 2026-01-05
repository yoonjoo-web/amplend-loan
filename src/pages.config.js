import Dashboard from './pages/Dashboard';
import Loans from './pages/Loans';
import Borrowers from './pages/Borrowers';
import Settings from './pages/Settings';
import Applications from './pages/Applications';
import NewApplication from './pages/NewApplication';
import MyProfile from './pages/MyProfile';
import Entities from './pages/Entities';
import LoanPartners from './pages/LoanPartners';
import LoanOfficerQueue from './pages/LoanOfficerQueue';
import LoanDetail from './pages/LoanDetail';
import Messages from './pages/Messages';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Onboarding from './pages/Onboarding';
import MyTasks from './pages/MyTasks';
import JoinRequest from './pages/JoinRequest';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Loans": Loans,
    "Borrowers": Borrowers,
    "Settings": Settings,
    "Applications": Applications,
    "NewApplication": NewApplication,
    "MyProfile": MyProfile,
    "Entities": Entities,
    "LoanPartners": LoanPartners,
    "LoanOfficerQueue": LoanOfficerQueue,
    "LoanDetail": LoanDetail,
    "Messages": Messages,
    "Contacts": Contacts,
    "ContactDetail": ContactDetail,
    "Onboarding": Onboarding,
    "MyTasks": MyTasks,
    "JoinRequest": JoinRequest,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};