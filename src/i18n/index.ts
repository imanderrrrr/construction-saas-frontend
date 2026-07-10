import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enAdmin from './locales/en/admin.json';
import enExpenses from './locales/en/expenses.json';
import enFinance from './locales/en/finance.json';
import enProjects from './locales/en/projects.json';
import enTime from './locales/en/time.json';
import enInventory from './locales/en/inventory.json';
import enUsers from './locales/en/users.json';
import enDashboard from './locales/en/dashboard.json';
import enWorker from './locales/en/worker.json';
import enSupervisor from './locales/en/supervisor.json';
import enSubcontractors from './locales/en/subcontractors.json';
import enPricing from './locales/en/pricing.json';
import enLanding from './locales/en/landing.json';
import enBilling from './locales/en/billing.json';
import enSiteLog from './locales/en/siteLog.json';
import enClientView from './locales/en/clientView.json';
import enPunchList from './locales/en/punchList.json';

// Spanish
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esAdmin from './locales/es/admin.json';
import esExpenses from './locales/es/expenses.json';
import esFinance from './locales/es/finance.json';
import esProjects from './locales/es/projects.json';
import esTime from './locales/es/time.json';
import esInventory from './locales/es/inventory.json';
import esUsers from './locales/es/users.json';
import esDashboard from './locales/es/dashboard.json';
import esWorker from './locales/es/worker.json';
import esSupervisor from './locales/es/supervisor.json';
import esSubcontractors from './locales/es/subcontractors.json';
import esPricing from './locales/es/pricing.json';
import esLanding from './locales/es/landing.json';
import esBilling from './locales/es/billing.json';
import esSiteLog from './locales/es/siteLog.json';
import esClientView from './locales/es/clientView.json';
import esPunchList from './locales/es/punchList.json';

const ns = ['common', 'auth', 'admin', 'expenses', 'finance', 'projects', 'time', 'inventory', 'users', 'dashboard', 'worker', 'supervisor', 'subcontractors', 'pricing', 'landing', 'billing', 'siteLog', 'clientView', 'punchList'] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        admin: enAdmin,
        expenses: enExpenses,
        finance: enFinance,
        projects: enProjects,
        time: enTime,
        inventory: enInventory,
        users: enUsers,
        dashboard: enDashboard,
        worker: enWorker,
        supervisor: enSupervisor,
        subcontractors: enSubcontractors,
        pricing: enPricing,
        landing: enLanding,
        billing: enBilling,
        siteLog: enSiteLog,
        clientView: enClientView,
        punchList: enPunchList,
      },
      es: {
        common: esCommon,
        auth: esAuth,
        admin: esAdmin,
        expenses: esExpenses,
        finance: esFinance,
        projects: esProjects,
        time: esTime,
        inventory: esInventory,
        users: esUsers,
        dashboard: esDashboard,
        worker: esWorker,
        supervisor: esSupervisor,
        subcontractors: esSubcontractors,
        pricing: esPricing,
        landing: esLanding,
        billing: esBilling,
        siteLog: esSiteLog,
        clientView: esClientView,
        punchList: esPunchList,
      },
    },
    fallbackLng: 'es',
    defaultNS: 'common',
    ns: [...ns],
    keySeparator: false,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ofjr_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
