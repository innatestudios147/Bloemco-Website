export type StaffRole = 'pending' | 'editor' | 'admin';

export interface StaffProfile {
  id: string;
  auth_provider_id: string | null;
  email: string;
  display_name: string | null;
  role: StaffRole;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Attachment {
  name: string;
  url: string;
  size: number;
  contentType: string;
}

export type PostStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category_id: string | null;
  blog_categories?: BlogCategory | null;
  cover_image_url: string | null;
  images: string[];
  attachments: Attachment[];
  author_id: string;
  author_name: string;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
