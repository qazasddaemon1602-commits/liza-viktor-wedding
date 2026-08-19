UPDATE auth.users
SET encrypted_password = crypt('Wed-Pys57XTpc7RDdaUr-26', gen_salt('bf')),
    updated_at = now()
WHERE id = 'cb0af06e-fba8-4d57-bd67-86c542ee69f5'
  AND email = 'owner@wedding.test';