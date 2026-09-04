export const translations = {
  fr: { home:'Accueil', room:'Ma chambre', planner:'Planning', grades:'Notes', settings:'Réglages', upcoming:'À venir', lowStock:'Stock faible', sync:'Synchroniser Pronote', reminder:'Rappel du soir', noEvents:'Aucun élément à venir', all:'Tout', assignments:'Devoirs', courses:'Cours' },
  en: { home:'Home', room:'My room', planner:'Planner', grades:'Grades', settings:'Settings', upcoming:'Upcoming', lowStock:'Low stock', sync:'Sync Pronote', reminder:'Evening reminder', noEvents:'Nothing upcoming', all:'All', assignments:'Assignments', courses:'Courses' }
} as const;
export type Locale = keyof typeof translations;
export const t = (locale: Locale, key: keyof typeof translations.fr) => translations[locale][key];
