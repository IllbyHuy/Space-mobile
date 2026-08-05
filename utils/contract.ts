export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  Draft: 'Chưa ký',
  Active: 'Đã ký',
  Expired: 'Hết hạn',
  Cancelled: 'Đã huỷ',
};

export const CONTRACT_STATUS_COLOR: Record<string, string> = {
  Draft: '#D97706',
  Active: '#00A67E',
  Expired: '#6B7280',
  Cancelled: '#E02424',
};

export const formatCurrency = (value?: number): string =>
  value || value === 0 ? `${value.toLocaleString('vi-VN')} VNĐ` : '...';

export const formatDate = (value?: string): string =>
  value ? new Date(value).toLocaleDateString('vi-VN') : '...';

// Đơn vị thời hạn hợp đồng "sống" là chuỗi enum của BE: 'Days'|'Weeks'|'Months'|'Years'.
export const formatDurationUnit = (unit?: string): string => {
  if (unit === 'Days') return 'ngày';
  if (unit === 'Weeks') return 'tuần';
  if (unit === 'Months') return 'tháng';
  if (unit === 'Years') return 'năm';
  return unit || '...';
};

// Coi 1 giá trị là "đã ký"/"đã bắt đầu" nếu nó true, hoặc chuỗi không rỗng (timestamp).
const isTruthySigned = (v: any) => v === true || (typeof v === 'string' && v.trim().length > 0);

// Dò trạng thái ký của từng bên từ nhiều khả năng đặt tên field của BE (chưa có tài liệu
// chính thức — nếu sai, gọi GetById 1 hợp đồng đã ký để xem field thật rồi sửa lại đây).
export const getSignFlags = (contract: any) => {
  const lessorSigned = isTruthySigned(
    contract?.isSignedByLessor ??
      contract?.IsSignedByLessor ??
      contract?.lessorSignedAt ??
      contract?.LessorSignedAt ??
      contract?.lessorSignDate ??
      contract?.LessorSignDate
  );
  const lesseeSigned = isTruthySigned(
    contract?.isSignedByLessee ??
      contract?.IsSignedByLessee ??
      contract?.lesseeSignedAt ??
      contract?.LesseeSignedAt ??
      contract?.lesseeSignDate ??
      contract?.LesseeSignDate
  );
  return { lessorSigned, lesseeSigned };
};

export const getSigningSessionStarted = (contract: any): boolean => {
  const s = contract?.status ?? contract?.Status;
  if (s != null && s !== '') return s !== 'Draft';
  return isTruthySigned(
    contract?.isSigningSessionStarted ??
      contract?.IsSigningSessionStarted ??
      contract?.signingSessionStarted ??
      contract?.SigningSessionStarted ??
      contract?.signingStartedAt ??
      contract?.SigningStartedAt
  );
};

export const extractServerMessage = async (response: Response): Promise<string> => {
  const raw = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.message) return parsed.message;
  } catch {
    // raw không phải JSON, giữ nguyên chuỗi thô
  }
  return raw;
};

export const getInitials = (name: string): string =>
  name.split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase() || '??';

export const monthsBetween = (start?: string, end?: string): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)));
};

export const monthsElapsed = (start?: string): number => {
  if (!start) return 0;
  const s = new Date(start);
  const now = new Date();
  return Math.max(0, Math.round((now.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)));
};

// Càng gần hết hạn càng ngả từ xanh sang vàng sang đỏ (cảnh báo cần gia hạn/xử lý).
export const getUrgencyColor = (remainingRatio: number, status: string): string => {
  if (status !== 'Active') return '#9CA3AF';
  if (remainingRatio <= 0.15) return '#E02424';
  if (remainingRatio <= 0.4) return '#D97706';
  return '#00A67E';
};
