import { supabase } from './supabase';
import type { Attachment } from './types';

export const BUCKET = 'blog-media';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — see README for why.

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

function randomKey(name: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-').slice(-60);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}-${safe}`;
}

export async function uploadImage(file: File, folder: 'covers' | 'gallery' | 'editor'): Promise<Attachment> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Please choose a JPEG, PNG, WebP, GIF or AVIF image.');
  return uploadAny(file, folder);
}

export async function uploadDocument(file: File): Promise<Attachment> {
  if (!DOC_TYPES.includes(file.type)) throw new Error('Please choose a PDF, Word, Excel, PowerPoint or text file.');
  return uploadAny(file, 'attachments');
}

async function uploadAny(file: File, folder: string): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is too large — the limit is ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB.`);
  }
  const key = `${folder}/${randomKey(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { name: file.name, url: data.publicUrl, size: file.size, contentType: file.type };
}
