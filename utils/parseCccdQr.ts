export interface CccdQrData {
  idNumber: string;
  oldIdNumber: string | null;
  fullName: string;
  dateOfBirthRaw: string;
  dateOfBirthIso: string;
  gender: string;
  permanentAddress: string;
  issueDateRaw: string;
  issueDateIso: string;
}

export interface CccdParseError {
  code: 'EMPTY_INPUT' | 'INVALID_FIELD_COUNT' | 'INVALID_FORMAT' | 'INVALID_DATE';
  message: string;
}

export type CccdParseResult =
  | { success: true; data: CccdQrData }
  | { success: false; error: CccdParseError };

const CCCD_FIELD_COUNT = 7;
const ID_NUMBER_PATTERN = /^\d{9,12}$/;

function parseDdmmyyyy(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return null;

  const day = Number(raw.slice(0, 2));
  const month = Number(raw.slice(2, 4));
  const year = Number(raw.slice(4, 8));

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parseCccdQr(rawText: string): CccdParseResult {
  if (!rawText?.trim()) {
    return {
      success: false,
      error: { code: 'EMPTY_INPUT', message: 'Không có dữ liệu để xử lý.' },
    };
  }

  const fields = rawText.split('|');
  if (fields.length !== CCCD_FIELD_COUNT) {
    return {
      success: false,
      error: {
        code: 'INVALID_FIELD_COUNT',
        message: 'Không nhận diện được thông tin CCCD hợp lệ.',
      },
    };
  }

  const [idNumber, oldIdNumber, fullName, dobRaw, gender, address, issueDateRaw] = fields.map((f) =>
    f.trim()
  );

  if (!ID_NUMBER_PATTERN.test(idNumber)) {
    return {
      success: false,
      error: { code: 'INVALID_FORMAT', message: 'Không nhận diện được thông tin CCCD hợp lệ.' },
    };
  }

  const dateOfBirthIso = parseDdmmyyyy(dobRaw);
  const issueDateIso = parseDdmmyyyy(issueDateRaw);
  if (!dateOfBirthIso || !issueDateIso) {
    return {
      success: false,
      error: { code: 'INVALID_DATE', message: 'Ngày sinh hoặc ngày cấp không hợp lệ.' },
    };
  }

  const data: CccdQrData = {
    idNumber,
    oldIdNumber: oldIdNumber === '' ? null : oldIdNumber,
    fullName,
    dateOfBirthRaw: dobRaw,
    dateOfBirthIso,
    gender,
    permanentAddress: address,
    issueDateRaw,
    issueDateIso,
  };

  return { success: true, data };
}
