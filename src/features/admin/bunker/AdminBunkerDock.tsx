import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { loadOwnerDashboard } from '../admin.service';
import { AdminBunkerControl } from './AdminBunkerControl';

const EVENT_SLUG = 'liza-viktor';

export function AdminBunkerDock() {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let client: ReturnType<typeof getSupabaseClient>;

    try {
      client = getSupabaseClient();
    } catch {
      return;
    }

    const probeOwnerEvent = () => {
      void loadOwnerDashboard(client, EVENT_SLUG)
        .then((dashboard) => {
          if (active) setEventId(dashboard.event.id);
        })
        .catch(() => {
          if (active) setEventId(null);
        });
    };

    probeOwnerEvent();
    const interval = window.setInterval(probeOwnerEvent, eventId ? 15_000 : 1_500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [eventId]);

  if (!eventId) return null;

  return (
    <aside className="admin-bunker-dock" aria-label="Экстренный сюжетный поворот">
      <AdminBunkerControl eventId={eventId} />
    </aside>
  );
}
