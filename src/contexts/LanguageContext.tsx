import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'nl' | 'en';

interface Translations {
  [key: string]: {
    nl: string;
    en: string;
  };
}

export const translations: Translations = {
  // Navigation
  'nav.dashboard': { nl: 'Dashboard', en: 'Dashboard' },
  'nav.profile': { nl: 'Profiel', en: 'Profile' },
  'nav.dailyLogs': { nl: 'Dagelijkse Logs', en: 'Daily Logs' },
  'nav.measurements': { nl: 'Metingen', en: 'Measurements' },
  'nav.comparisons': { nl: 'Vergelijking', en: 'Comparison' },
  'nav.photos': { nl: "Foto's", en: 'Photos' },
  'nav.sleep': { nl: 'Slaap', en: 'Sleep' },
  'nav.workouts': { nl: 'Workouts', en: 'Workouts' },
  'nav.exercises': { nl: 'Oefeningen', en: 'Exercises' },
  'nav.progressPhotos': { nl: "Progressfoto's", en: 'Progress Photos' },
  'nav.admin': { nl: 'Admin', en: 'Admin' },
  'nav.health': { nl: 'Health', en: 'Health' },
  'nav.logout': { nl: 'Uitloggen', en: 'Logout' },
  'nav.more': { nl: 'Meer', en: 'More' },
  'nav.nutrition': { nl: 'Voeding', en: 'Nutrition' },
  
  // Auth
  'auth.login': { nl: 'Inloggen', en: 'Login' },
  'auth.signup': { nl: 'Aanmelden', en: 'Sign Up' },
  'auth.email': { nl: 'E-mail', en: 'Email' },
  'auth.password': { nl: 'Wachtwoord', en: 'Password' },
  'auth.confirmPassword': { nl: 'Bevestig Wachtwoord', en: 'Confirm Password' },
  'auth.fullName': { nl: 'Volledige Naam', en: 'Full Name' },
  'auth.noAccount': { nl: 'Nog geen account?', en: "Don't have an account?" },
  'auth.hasAccount': { nl: 'Heb je al een account?', en: 'Already have an account?' },
  
  // Profile
  'profile.title': { nl: 'Mijn Profiel', en: 'My Profile' },
  'profile.currentWeight': { nl: 'Huidig Gewicht (kg)', en: 'Current Weight (kg)' },
  'profile.targetWeight': { nl: 'Streefgewicht (kg)', en: 'Target Weight (kg)' },
  'profile.height': { nl: 'Lengte (cm)', en: 'Height (cm)' },
  'profile.goals': { nl: 'Doelen', en: 'Goals' },
  'profile.instagram': { nl: 'Instagram', en: 'Instagram' },
  'profile.save': { nl: 'Opslaan', en: 'Save' },
  
  // Daily Logs
  'logs.title': { nl: 'Dagelijkse Logs', en: 'Daily Logs' },
  'logs.date': { nl: 'Datum', en: 'Date' },
  'logs.steps': { nl: 'Stappen', en: 'Steps' },
  'logs.workout': { nl: 'Workout', en: 'Workout' },
  'logs.calorieIntake': { nl: 'Calorie Inname', en: 'Calorie Intake' },
  'logs.calorieBurn': { nl: 'Calorie Verbranding', en: 'Calorie Burn' },
  'logs.weight': { nl: 'Gewicht (kg)', en: 'Weight (kg)' },
  'logs.bodyFat': { nl: 'Vetpercentage', en: 'Body Fat %' },
  'logs.notes': { nl: 'Notities', en: 'Notes' },
  'logs.addLog': { nl: 'Voeg Log Toe', en: 'Add Log' },
  
  // Measurements
  'measurements.title': { nl: 'Lichaamsmetingen', en: 'Body Measurements' },
  'measurements.chest': { nl: 'Borst (cm)', en: 'Chest (cm)' },
  'measurements.waist': { nl: 'Taille (cm)', en: 'Waist (cm)' },
  'measurements.hips': { nl: 'Heupen (cm)', en: 'Hips (cm)' },
  'measurements.bicepLeft': { nl: 'Bicep Links (cm)', en: 'Bicep Left (cm)' },
  'measurements.bicepRight': { nl: 'Bicep Rechts (cm)', en: 'Bicep Right (cm)' },
  
  // Comparisons
  'comparisons.title': { nl: 'Vergelijking', en: 'Comparison' },
  'comparisons.selectFirst': { nl: 'Selecteer Eerste Meting', en: 'Select First Measurement' },
  'comparisons.selectSecond': { nl: 'Selecteer Tweede Meting', en: 'Select Second Measurement' },
  'comparisons.compare': { nl: 'Vergelijk', en: 'Compare' },
  'comparisons.difference': { nl: 'Verschil', en: 'Difference' },
  'comparisons.change': { nl: 'Verandering', en: 'Change' },
  'comparisons.noData': { nl: 'Selecteer twee metingen om te vergelijken', en: 'Select two measurements to compare' },
  
  // Common
  'common.save': { nl: 'Opslaan', en: 'Save' },
  'common.cancel': { nl: 'Annuleren', en: 'Cancel' },
  'common.delete': { nl: 'Verwijderen', en: 'Delete' },
  'common.edit': { nl: 'Bewerken', en: 'Edit' },
  'common.loading': { nl: 'Laden...', en: 'Loading...' },
  
  // Theme
  'theme.title': { nl: 'Thema', en: 'Theme' },
  'theme.light': { nl: 'Licht', en: 'Light' },
  'theme.dark': { nl: 'Donker', en: 'Dark' },
  'theme.system': { nl: 'Systeeminstellingen', en: 'System' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'nl' || saved === 'en') ? saved : 'nl';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
