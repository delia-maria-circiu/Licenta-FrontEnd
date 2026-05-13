export interface UserProfile {
  id: number;
  username: string;
  name: string;
  email: string;
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  avatarUrl: string | null;
  memberSince?: string;
}