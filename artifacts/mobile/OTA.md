# Mises à jour Zbarber à distance (OTA)

## Nouveau build de référence

| Profil de build | Canal OTA | Environnement Expo | API |
| --- | --- | --- | --- |
| `test` | `test` | `preview` | `api.test.zbarber.net` |
| `production` | `production` | `production` | `api.zbarber.net` |

Construire les deux profils depuis une révision contenant cette configuration.
La version affichée reste `1.0.1`, mais le nouveau runtime est `1.0.1-ota.2`.
Le lecteur natif des publicités vidéo requiert un nouveau build pour chaque
profil. Les builds aux runtimes `1.0.1` ou `1.0.1-ota.1` ne peuvent pas recevoir ces OTA,
même s’ils avaient lu le canal `production` imposé par l’ancienne configuration.
Dans Expo, vérifier que les canaux `test` et `production` pointent vers **des
branches de mises à jour différentes**.

## Publier les prochaines OTA

1. Associer le dépôt GitHub au projet Expo et utiliser `artifacts/mobile` comme
   répertoire de l’application Expo dans le dépôt.
2. Dans **Environment variables** du projet Expo, définir la variable publique
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` en visibilité **Plain text** dans les
   environnements `preview` et `production`. Elle doit correspondre à la clé
   **publiable** des profils dans `eas.json`. Ne jamais utiliser une clé secrète
   Clerk. L’API et le proxy sont déjà définis dans les workflows.
3. Sur la révision Git à livrer, déclencher manuellement `ota-test.yml` (voir
   [l’API de déclenchement Expo](https://docs.expo.dev/eas/workflows/rest-api/)).
   Vérifier dans **Updates** le canal et le runtime, puis tester l’application
   installée avec le nouveau build `test`.
4. Une fois la révision validée, déclencher `ota-production.yml` depuis **la même
   révision** et vérifier le nouveau build `production`. Ne pas publier une
   OTA automatique depuis une branche Git.

Garder le runtime inchangé pour les modifications JavaScript et les ressources
compatibles. Pour toute modification native incompatible (SDK, module natif,
permissions, plugin de configuration), définir un nouveau runtime et distribuer
un nouveau build avant d’y publier des OTA. Une OTA ne met pas à jour le serveur
API ni sa base de données.
