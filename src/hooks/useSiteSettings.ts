import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SiteSettings {
  whatsappChannelUrl?: string;
  updatedAt?: string;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, 'settings', 'site'),
        (snapshot) => {
          if (snapshot.exists()) {
            setSettings(snapshot.data() as SiteSettings);
          } else {
            setSettings({});
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Settings subscription fallback:', error);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('Settings init error:', err);
      setLoading(false);
    }
  }, []);

  return { settings, loading };
}
