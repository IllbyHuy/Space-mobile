export const formatVnd = (amount: number): string => `${amount.toLocaleString('vi-VN')}₫`;

export interface WalletOwnerUser {
  userId: string;
  phoneNumber: string | null;
  email: string | null;
  role: string;
  userStatus: string;
  profileFullName: string | null;
  profileAvatarUrl: string | null;
}

export interface WalletAccount {
  id: number;
  balance: number;
  user: WalletOwnerUser;
  name: string | null;
}

export const QUICK_AMOUNTS = [100000, 200000, 500000, 1000000, 2000000, 5000000];
export const MIN_DEPOSIT_AMOUNT = 2000;
