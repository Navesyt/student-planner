# Student Planner

Application mobile Expo + React Native + TypeScript pour étudiant/prépa.

## Fonctionnalités

- Dashboard avec prochains éléments et stock faible
- Inventaire « Ma chambre » avec boutons +/-
- Planning unifié
- Événements manuels + événements générés depuis le tableau combiné khôlloscope + TP-scope
- Profil de groupes : groupe principal, tiers-groupe, demi-groupe et trinôme
- Import intégré de PDF, Excel et CSV
- Filtrage automatique des lignes correspondant au profil de groupes
- Notes sur /20 avec coefficients et moyennes pondérées
- Français + English
- SQLite local-first
- Notifications locales à 19h via `expo-notifications`

## Import khôlloscope + TP-scope

L'utilisateur connaît déjà ses groupes et les renseigne dans l'application. Il peut ensuite importer le tableau combiné depuis :

- PDF
- `.xlsx`
- CSV

Les lignes correspondant au groupe, tiers-groupe, demi-groupe ou trinôme sont transformées en événements du planning.

Les événements générés sont séparés des événements `manual`. Une réimportation remplace uniquement les événements générés et ne modifie jamais les événements créés manuellement.

Le moteur de correspondance et de parsing se trouve dans `src/groupPlanner.ts`, tandis que la sélection et la lecture des fichiers sont dans `src/groupImport.ts`.

Les PDF numériques sont lus localement avec `@paul_sizon/expo-pdf-text-extract`. Cette dépendance native nécessite une Expo development build ; un PDF constitué uniquement d'images nécessitera une future couche OCR.

## Données

SQLite contient les matières, événements académiques, inventaire, notes, profil de groupes et documents importés.

Les événements académiques ont désormais deux origines : `manual` et `generated`.

## Lancer

```bash
npm install
npx expo start
```

Pour l'extraction PDF native, utiliser une development build plutôt qu'Expo Go.

## Prochaines étapes

1. Adapter le parsing aux premiers vrais tableaux de la classe.
2. Ajouter une vue calendrier jour/semaine plus complète.
3. Ajouter un vrai export/import de fichiers JSON partageables.
4. Ajouter des tests sur plusieurs formats de tableaux réels.
5. Ajouter éventuellement l'OCR pour les PDF scannés.
