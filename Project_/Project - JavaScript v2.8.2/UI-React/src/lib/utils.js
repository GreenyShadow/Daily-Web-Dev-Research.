import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn/ui class-name combiner: merges conditional classes
// (clsx) and resolves conflicting Tailwind utility classes (tailwind-merge).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
