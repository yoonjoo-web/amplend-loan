/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Borrowers from './pages/Borrowers';
import Entities from './pages/Entities';
import JoinRequest from './pages/JoinRequest';
import LoanOfficerQueue from './pages/LoanOfficerQueue';
import LoanPartners from './pages/LoanPartners';
import Messages from './pages/Messages';
import MyProfile from './pages/MyProfile';
import Applications from './pages/Applications';
import ContactDetail from './pages/ContactDetail';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import LoanDetail from './pages/LoanDetail';
import Loans from './pages/Loans';
import MyBorrowers from './pages/MyBorrowers';
import MyTasks from './pages/MyTasks';
import NewApplication from './pages/NewApplication';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Borrowers": Borrowers,
    "Entities": Entities,
    "JoinRequest": JoinRequest,
    "LoanOfficerQueue": LoanOfficerQueue,
    "LoanPartners": LoanPartners,
    "Messages": Messages,
    "MyProfile": MyProfile,
    "Applications": Applications,
    "ContactDetail": ContactDetail,
    "Contacts": Contacts,
    "Dashboard": Dashboard,
    "LoanDetail": LoanDetail,
    "Loans": Loans,
    "MyBorrowers": MyBorrowers,
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