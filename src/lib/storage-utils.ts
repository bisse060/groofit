import { supabase } from '@/integrations/supabase/client';

/**
 * Get a signed URL for a progress photo stored in the private bucket.
 * Extracts the file path from the stored public URL and creates a signed URL.
 */
export async function getSignedPhotoUrl(storedUrl: string, expiresIn = 3600): Promise<string> {
  try {
    // Extract path from stored public URL
    // Format: .../storage/v1/object/public/progress-photos/userId/measurementId/type.ext
    const marker = '/object/public/progress-photos/';
    const idx = storedUrl.indexOf(marker);
    if (idx === -1) return storedUrl; // Not a progress-photos URL, return as-is

    const filePath = storedUrl.substring(idx + marker.length);

    const { data, error } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error('Error creating signed URL:', error);
      return storedUrl; // Fallback to stored URL
    }

    return data.signedUrl;
  } catch {
    return storedUrl;
  }
}

/**
 * Convert an array of photos with photo_url to use signed URLs.
 */
export async function signPhotoUrls<T extends { photo_url: string }>(photos: T[]): Promise<T[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      photo_url: await getSignedPhotoUrl(photo.photo_url),
    }))
  );
}
