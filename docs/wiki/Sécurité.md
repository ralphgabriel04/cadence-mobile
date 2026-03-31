# 🔒 Sécurité

## Authentification

| Aspect | Implémentation |
|--------|---------------|
| Provider | Supabase Auth (GoTrue) |
| Méthodes | Magic Link, Google OAuth, Apple Sign-In |
| Token storage | Expo SecureStore (chiffré) |
| Session | JWT, refresh automatique |
| Deep linking | Schéma URL sécurisé pour les magic links |

## Base de données

| Aspect | Implémentation |
|--------|---------------|
| RLS | Activé sur **toutes** les tables |
| Accès | Uniquement via Supabase client (jamais d'accès direct) |
| Migrations | Versionnées, reviewées, testées |
| Backups | Automatiques via Supabase (point-in-time recovery) |
| Encryption | At rest (AES-256) + in transit (TLS 1.3) |

## Données utilisateur

| Aspect | Implémentation |
|--------|---------------|
| PII | Minimiser la collecte, chiffrer au repos |
| Images | Stockées dans Supabase Storage (buckets privés) |
| Messages | Chiffrés en transit, accès restreint par RLS |
| Logs | Pas de PII dans les logs applicatifs |
| Suppression | Cascade complète à la suppression du compte |

## Conformité

| Aspect | Statut |
|--------|--------|
| Loi 25 (Québec) | Requis — politique de confidentialité, consentement |
| PIPEDA | Requis — protection des données personnelles |
| GDPR | Non requis (pas de marché EU), mais bonnes pratiques suivies |
| App Store Guidelines | Requis — pas de tracking sans consentement |

## Performance targets (sécurité)

| Métrique | Target |
|----------|--------|
| Auth response time | < 500ms |
| Token refresh | Transparent, < 100ms |
| Rate limiting | 100 req/min par utilisateur |
| Crash-free rate | > 99.5% |
| Uptime (Supabase) | > 99.9% |

## Bonnes pratiques

1. **Ne jamais** stocker de secrets dans le code
2. **Toujours** utiliser des variables d'environnement pour les clés
3. **Valider** toutes les entrées utilisateur côté client ET serveur
4. **Auditer** les dépendances régulièrement (`npm audit`)
5. **Activer** 2FA sur tous les comptes de service (GitHub, Supabase, Expo)
