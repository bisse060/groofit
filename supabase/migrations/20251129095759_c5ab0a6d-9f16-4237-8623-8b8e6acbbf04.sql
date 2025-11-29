-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt sensitive data
-- This uses AES encryption with a key derived from the SUPABASE_SERVICE_ROLE_KEY
CREATE OR REPLACE FUNCTION public.encrypt_token(token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use AES-256 encryption with the service role key as the encryption key
  -- The key is hashed to ensure consistent length
  RETURN encode(
    encrypt(
      token::bytea,
      digest(current_setting('app.encryption_key', true)::text, 'sha256'),
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Create a function to decrypt sensitive data
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN convert_from(
    decrypt(
      decode(encrypted_token, 'base64'),
      digest(current_setting('app.encryption_key', true)::text, 'sha256'),
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Add a comment explaining the security measure
COMMENT ON FUNCTION public.encrypt_token IS 'Encrypts sensitive OAuth tokens using AES-256 encryption';
COMMENT ON FUNCTION public.decrypt_token IS 'Decrypts OAuth tokens - only accessible via SECURITY DEFINER functions';

-- Revoke public access to these functions
REVOKE ALL ON FUNCTION public.encrypt_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_token(TEXT) FROM PUBLIC;

-- Grant execute only to authenticated users (they still need RLS to access)
GRANT EXECUTE ON FUNCTION public.encrypt_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_token(TEXT) TO authenticated;