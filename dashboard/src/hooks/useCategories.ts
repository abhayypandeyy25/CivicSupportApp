import { useState, useEffect } from 'react';
import { fetchCategories } from '../api/endpoints';
import type { Category } from '../api/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(console.error);
  }, []);

  return categories;
}
