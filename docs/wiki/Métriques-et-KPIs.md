# 📊 Métriques et KPIs

## North Star : WACAP

**WACAP** = Weekly Active Coach-Athlete Pairs

> Nombre de paires coach-athlète avec ≥1 interaction significative dans les 7 derniers jours.

| Phase | Target WACAP |
|-------|-------------|
| Alpha (Sprint 0-4) | 5 paires (test interne) |
| Beta (Sprint 5-9) | 25 paires |
| Launch (Sprint 11) | 100 paires |
| Post-launch +3 mois | 500 paires |

## Product Metrics

| Métrique | Description | Target |
|----------|-------------|--------|
| DAU/MAU ratio | Engagement quotidien vs mensuel | > 40% |
| Session completion rate | % de séances complétées vs assignées | > 65% |
| Time to first workout log | Temps entre inscription et premier log | < 24h |
| Coach activation rate | % de coachs qui assignent un programme dans la 1ère semaine | > 50% |
| Readiness form fill rate | % d'athlètes qui remplissent le readiness quotidien | > 30% |

## Growth Metrics

| Métrique | Description | Target |
|----------|-------------|--------|
| Coach acquisition cost | Coût d'acquisition d'un coach | < 20$ |
| Viral coefficient | Athlètes invités par coach | > 5 |
| Coach churn (monthly) | % de coachs qui quittent par mois | < 5% |
| Athlete churn (monthly) | % d'athlètes qui quittent par mois | < 10% |
| NPS | Net Promoter Score | > 50 |

## Engineering Metrics

| Métrique | Description | Target |
|----------|-------------|--------|
| Cold start time | Temps de lancement de l'app | < 2s |
| Crash-free rate | % de sessions sans crash | > 99.5% |
| API response time (p95) | Temps de réponse Supabase | < 200ms |
| Bundle size | Taille du bundle JS | < 15MB |
| Test coverage | Couverture des tests | > 70% |
| PR merge time | Temps moyen pour merger une PR | < 24h |

## Anti-vanity metrics

Ces métriques sont **trompeuses** et ne doivent PAS guider les décisions :

| ❌ Vanity | ✅ Actionable alternative |
|-----------|--------------------------|
| Total downloads | WACAP (engagement réel) |
| Total users | DAU/MAU ratio |
| Page views | Session completion rate |
| Social media followers | Coach acquisition cost |
| Total messages sent | Response rate (% messages lus < 1h) |
