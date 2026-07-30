import { supabase } from '../supabase';

const BUCKET = 'media';

/**
 * Upload a local image (an expo-image-picker URI) and return its public URL.
 *
 * Files are namespaced `<userId>/<name>` because the storage RLS policy in
 * migration 0003 authorises writes by reading the user id out of the first path
 * segment. Uploading anywhere else is rejected.
 *
 * React Native's fetch can read a `file://` URI into a Blob, but supabase-js
 * needs a known byte length — a streamed Blob uploads as 0 bytes on Android.
 * Converting to an ArrayBuffer first avoids that.
 */
export async function uploadImage(
  userId: string,
  localUri: string,
  folder: 'posts' | 'avatars' | 'banners' = 'posts'
): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error('Could not read the selected image.');

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) throw new Error('The selected image was empty.');

  const contentType = response.headers.get('content-type') ?? guessMime(localUri);
  const extension = extensionFor(contentType);
  // Random suffix so two picks in the same millisecond cannot collide.
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const path = `${userId}/${folder}/${name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImages(
  userId: string,
  localUris: string[],
  folder: 'posts' | 'avatars' | 'banners' = 'posts'
): Promise<string[]> {
  // Sequential on purpose: parallel uploads of several full-size photos on a
  // phone connection tend to time out rather than finish faster.
  const urls: string[] = [];
  for (const uri of localUris) {
    urls.push(await uploadImage(userId, uri, folder));
  }
  return urls;
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}
