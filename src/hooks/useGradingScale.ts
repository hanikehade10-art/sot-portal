import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { GradingScaleEntry } from '../types';
import { DEFAULT_GRADING_SCALE } from '../config/gradingScale';

export function useGradingScale() {
  const [scale, setScale] = useState<GradingScaleEntry[]>(DEFAULT_GRADING_SCALE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'grading_scale'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.scale) && data.scale.length > 0) {
            setScale(data.scale);
          } else {
            setScale(DEFAULT_GRADING_SCALE);
          }
        } else {
          setScale(DEFAULT_GRADING_SCALE);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Grading scale snapshot fallback:', error);
        setScale(DEFAULT_GRADING_SCALE);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { scale, loading };
}
