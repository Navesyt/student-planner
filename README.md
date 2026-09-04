# Student Planner

Application mobile Expo + React Native + TypeScript pour étudiant/prépa.

## MVP inclus

- Dashboard avec prochains cours/devoirs et stock faible
- Inventaire « Ma chambre » avec boutons +/-
- Planning unifié
- Modèle de notes sur /20 avec coefficients
- Français + English
- SQLite local-first
- Notifications locales à 19h via `expo-notifications`
- Mock Pronote derrière une interface `PronoteApi`
- La synchronisation Pronote ne modifie jamais les entrées `manual`

## Architecture Pronote

`src/pronote.ts` expose une interface remplaçable :

```ts
interface PronoteApi {
  fetchSchedule(from: string, to: string): Promise<AcademicItem[]>;
  fetchAssignments(from: string, to: string): Promise<AcademicItem[]>;
}
```

Le `MockPronoteApi` peut être remplacé par un adaptateur réel/local sans modifier l'UI ni la base. Pour une intégration réelle, privilégier une passerelle locale : les identifiants Pronote/ENT ne doivent pas être envoyés à un backend tiers.

## Données

SQLite contient `subjects`, `academic_items`, `inventory_items` et `grades`. Les événements académiques possèdent une origine `pronote` ou `manual`.

La synchro fait un upsert uniquement sur `(origin, external_id)` et n'écrase donc pas les éléments manuels.

## Lancer

```bash
npm install
npx expo start
```

Puis Android, iOS ou web depuis Expo.

## Prochaines étapes

1. Formulaires CRUD pour événements, devoirs, inventaire et notes.
2. Vue calendrier jour/semaine.
3. Calcul des moyennes pondérées.
4. Export/import JSON versionné.
5. Adaptateur Pronote local réel avec gestion de session et renouvellement sécurisé.
6. Tests automatisés de synchronisation et de protection des données manuelles.
