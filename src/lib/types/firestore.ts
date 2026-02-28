import type { Timestamp } from 'firebase/firestore';

// User Profile
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  plan: 'free' | 'starter' | 'pro';
  
  // Storage
  storageUsed: number;
  storageLimit: number;
  
  // Stats
  imagesGenerated: number;
  videosGenerated: number;
  postsPublished: number;
  
  // Content retention settings
  contentRetention: ContentRetentionSettings;

  // Subscription
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
  subscriptionPeriodEnd: Timestamp | null;
  stripePriceId: string | null;
}

export interface ContentRetentionSettings {
  autoDelete: boolean;
  deletionPeriod: 30 | 60 | 90 | null;
  deleteVideosOnly: boolean;
  warnBeforeDelete: boolean;
  lastWarningAt: Timestamp | null;
}


// Content
export interface Content {
  contentId: string;
  userId: string;
  type: 'image' | 'video';
  
  // Content details
  title: string;
  description: string;
  prompt: string;
  
  // File storage
  gcsPath: string;
  publicUrl: string;
  thumbnailUrl: string | null;
  
  // Metadata
  width: number;
  height: number;
  fileSize: number;
  format: string;
  duration: number | null;
  
  // Generation info
  model: string;
  generationTime: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Categorization
  tags: string[];
  category: string | null;
  
  // Status
  status: 'generating' | 'ready' | 'error' | 'deleted';
  
  // Usage tracking
  timesPosted: number;
  timesDownloaded: number;
  
  // Deletion tracking
  isPinned: boolean;
  markedForDeletion: boolean;
  deletionScheduledFor: Timestamp | null;
  deletionWarningsSent: number;
  isUsedInPost: boolean;
}

// Social Account
export interface SocialAccount {
  userId: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok';
  
  // Account info
  accountId: string;
  accountName: string;
  accountDisplayName: string;
  accountPhotoUrl: string | null;
  
  // OAuth tokens (encrypted)
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: Timestamp;
  
  // Permissions
  scopes: string[];
  
  // Status
  status: 'active' | 'expired' | 'disconnected' | 'error';
  lastVerified: Timestamp;
  
  // Rate limiting
  dailyPostLimit: number;
  postsToday: number;
  lastPostAt: Timestamp | null;
  
  // Timestamps
  connectedAt: Timestamp;
  updatedAt: Timestamp;
}

// Post
export interface Post {
  postId: string;
  userId: string;
  contentId: string;
  
  // Platform info
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok';
  platformPostId: string | null;
  platformUrl: string | null;
  
  // Post details
  caption: string;
  hashtags: string[];
  
  // Status
  status: 'scheduled' | 'publishing' | 'published' | 'failed';
  
  // Timestamps
  scheduledFor: Timestamp | null;
  publishedAt: Timestamp | null;
  createdAt: Timestamp;
  
  // Analytics
  likes: number;
  comments: number;
  shares: number;
  views: number;
  lastSyncedAt: Timestamp | null;
}