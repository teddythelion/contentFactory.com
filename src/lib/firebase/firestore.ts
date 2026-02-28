import { db } from '$lib/firebase/client';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import type { User, Content, SocialAccount, Post, ContentRetentionSettings } from '$lib/types/firestore';

// ==================== USERS ====================

export async function createUserProfile(uid: string, email: string, displayName: string | null, photoURL: string | null) {
  const userRef = doc(db, 'users', uid);
  
  const userData: User = {
    uid,
    email,
    displayName,
    photoURL,
    createdAt: serverTimestamp() as Timestamp,
    lastLogin: serverTimestamp() as Timestamp,
    plan: 'free',
    storageUsed: 0,
    storageLimit: 5368709120, // 5GB
    imagesGenerated: 0,
    videosGenerated: 0,
    postsPublished: 0,
    contentRetention: {
      autoDelete: false,
      deletionPeriod: 30,
      deleteVideosOnly: false,
      warnBeforeDelete: true,
      lastWarningAt: null
    },
    
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionPeriodEnd: null,
      stripePriceId: null
    
  };
  
  await setDoc(userRef, userData);
  return userData;
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as User;
  }
  return null;
}

export async function updateUserProfile(uid: string, updates: Partial<User>) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
}

export async function updateContentRetentionSettings(uid: string, settings: Partial<ContentRetentionSettings>) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    'contentRetention': settings
  });
}

export async function updateLastLogin(uid: string) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    lastLogin: serverTimestamp()
  });
}

// ==================== CONTENT ====================

export async function createContent(contentData: Omit<Content, 'contentId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const contentRef = doc(collection(db, 'content'));
  const contentId = contentRef.id;
  
  const fullContentData: Content = {
    ...contentData,
    contentId,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp
  };
  
  await setDoc(contentRef, fullContentData);
  return contentId;
}

export async function getContent(contentId: string): Promise<Content | null> {
  const contentRef = doc(db, 'content', contentId);
  const contentSnap = await getDoc(contentRef);
  
  if (contentSnap.exists()) {
    return contentSnap.data() as Content;
  }
  return null;
}

export async function getUserContent(userId: string, contentType?: 'image' | 'video', limitCount: number = 50): Promise<Content[]> {
  const contentCollection = collection(db, 'content');
  let q = query(
    contentCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  if (contentType) {
    q = query(
      contentCollection,
      where('userId', '==', userId),
      where('type', '==', contentType),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Content);
}

export async function updateContent(contentId: string, updates: Partial<Content>) {
  const contentRef = doc(db, 'content', contentId);
  await updateDoc(contentRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteContent(contentId: string) {
  const contentRef = doc(db, 'content', contentId);
  await deleteDoc(contentRef);
}

export async function togglePinContent(contentId: string, isPinned: boolean) {
  await updateContent(contentId, { isPinned });
}

// ==================== SOCIAL ACCOUNTS ====================

export async function createSocialAccount(accountData: Omit<SocialAccount, 'connectedAt' | 'updatedAt'>): Promise<void> {
  const accountId = `${accountData.userId}_${accountData.platform}`;
  const accountRef = doc(db, 'socialAccounts', accountId);
  
  const fullAccountData: SocialAccount = {
    ...accountData,
    connectedAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp
  };
  
  await setDoc(accountRef, fullAccountData);
}

export async function getSocialAccount(userId: string, platform: string): Promise<SocialAccount | null> {
  const accountId = `${userId}_${platform}`;
  const accountRef = doc(db, 'socialAccounts', accountId);
  const accountSnap = await getDoc(accountRef);
  
  if (accountSnap.exists()) {
    return accountSnap.data() as SocialAccount;
  }
  return null;
}

export async function getUserSocialAccounts(userId: string): Promise<SocialAccount[]> {
  const accountsCollection = collection(db, 'socialAccounts');
  const q = query(accountsCollection, where('userId', '==', userId));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as SocialAccount);
}

export async function updateSocialAccount(userId: string, platform: string, updates: Partial<SocialAccount>) {
  const accountId = `${userId}_${platform}`;
  const accountRef = doc(db, 'socialAccounts', accountId);
  await updateDoc(accountRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteSocialAccount(userId: string, platform: string) {
  const accountId = `${userId}_${platform}`;
  const accountRef = doc(db, 'socialAccounts', accountId);
  await deleteDoc(accountRef);
}

// ==================== POSTS ====================

export async function createPost(postData: Omit<Post, 'postId' | 'createdAt'>): Promise<string> {
  const postRef = doc(collection(db, 'posts'));
  const postId = postRef.id;
  
  const fullPostData: Post = {
    ...postData,
    postId,
    createdAt: serverTimestamp() as Timestamp
  };
  
  await setDoc(postRef, fullPostData);
  return postId;
}

export async function getPost(postId: string): Promise<Post | null> {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  
  if (postSnap.exists()) {
    return postSnap.data() as Post;
  }
  return null;
}

export async function getUserPosts(userId: string, limitCount: number = 50): Promise<Post[]> {
  const postsCollection = collection(db, 'posts');
  const q = query(
    postsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Post);
}

export async function updatePost(postId: string, updates: Partial<Post>) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, updates);
}

export async function deletePost(postId: string) {
  const postRef = doc(db, 'posts', postId);
  await deleteDoc(postRef);
}