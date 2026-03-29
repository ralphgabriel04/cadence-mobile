# 📝 Conventions de code

## TypeScript

- **Strict mode** activé (`"strict": true` dans tsconfig)
- **No `any`** — utiliser `unknown` si le type est inconnu
- **Interfaces** pour les objets, **types** pour les unions/intersections
- **Enums** : préférer les union types (`type Role = 'coach' | 'athlete'`)

## Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants | PascalCase | `WorkoutCard.tsx` |
| Hooks | camelCase avec `use` | `useWorkouts.ts` |
| Utilitaires | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `type Workout = {...}` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Fichiers de route | kebab-case | `workout-details.tsx` |
| Dossiers | kebab-case | `workout-tracker/` |

## Structure d'un composant

```tsx
// 1. Imports
import { View, Text } from 'react-native';
import { useWorkouts } from '@/hooks/useWorkouts';

// 2. Types
interface WorkoutCardProps {
  workout: Workout;
  onPress: () => void;
}

// 3. Composant
export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  // 3a. Hooks
  const { data } = useWorkouts();

  // 3b. Handlers
  const handlePress = () => {
    onPress();
  };

  // 3c. Render
  return (
    <View className="bg-white dark:bg-gray-900 rounded-xl p-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">
        {workout.name}
      </Text>
    </View>
  );
}
```

## Dark Mode

- **Obligatoire** sur chaque composant visuel
- Utiliser les classes NativeWind `dark:` prefix
- Couleurs de base : `bg-white dark:bg-gray-950`, `text-gray-900 dark:text-white`
- Tester les deux modes avant chaque PR

## Imports

- Utiliser les alias `@/` pour les imports absolus
- Ordre : React/RN → Third-party → Local → Types
- Pas d'imports par défaut pour les composants (named exports)

## Tests

- Un fichier `.test.tsx` par composant
- Tests unitaires pour les hooks et utilitaires
- Tests de composants avec React Native Testing Library
- Couverture minimale : 70%
