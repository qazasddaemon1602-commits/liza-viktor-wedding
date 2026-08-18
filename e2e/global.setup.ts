import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.E2E_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('E2E Supabase environment is missing');
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listed, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  let owner = listed.users.find((user) => user.email === OWNER_EMAIL) ?? null;
  if (!owner) {
    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    owner = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(owner.id, {
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  }

  const { error: deleteError } = await admin.from('events').delete().eq('slug', 'liza-viktor');
  if (deleteError) throw deleteError;

  const ownerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await ownerClient.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (signInError) throw signInError;

  const { error: createEventError } = await ownerClient.rpc('owner_create_event', {
    p_slug: 'liza-viktor',
    p_name: 'Лиза × Виктор',
  });
  if (createEventError) throw createEventError;

  await ownerClient.auth.signOut();
}
