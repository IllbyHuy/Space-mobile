// contractTemplates.ts
// 3 mẫu hợp đồng thuê mặt bằng — đã cập nhật căn cứ pháp lý hiện hành (2026)
// và gắn sẵn các "merge field" dạng {{TEN_BIEN}} để hệ thống cho thuê mặt bằng
// online tự động đổ dữ liệu (địa chỉ, giá, cọc, thời hạn, mã yêu cầu thuê,
// lịch hoạt động...) vào chỗ trống thay vì để dấu "......" như bản gốc.
//
// CĂN CỨ PHÁP LÝ ĐÃ CẬP NHẬT (thay cho các căn cứ cũ trong file .doc gốc):
// - Bộ luật Dân sự số 91/2015/QH13 (24/11/2015) — vẫn là luật gốc điều chỉnh
//   hợp đồng thuê tài sản (Điều 472-482), hiện chưa có bộ luật thay thế.
// - Luật Kinh doanh bất động sản số 29/2023/QH15 (28/11/2023), hiệu lực từ
//   01/8/2024 — thay thế Luật Kinh doanh BĐS 2014, áp dụng cho giao dịch
//   cho thuê nhà, công trình xây dựng, mặt bằng thương mại.
// - Luật Nhà ở số 27/2023/QH15 (Điều 121, 122) — quyền cho thuê, hợp đồng thuê.
// - Luật Đất đai số 31/2024/QH15 — áp dụng nếu mặt bằng gắn với quyền sử dụng đất.
// - Luật Công chứng số 46/2024/QH15, hiệu lực từ 01/7/2025 — thay Luật Công
//   chứng 2014, áp dụng cho mẫu có công chứng.
// - Luật Căn cước số 26/2023/QH15 — CMND đã hết giá trị sử dụng từ 01/01/2025,
//   toàn bộ mẫu đã đổi "Số CMND" thành "Số CCCD/Định danh cá nhân".
// - Luật Thương mại số 36/2005/QH11 — vẫn còn hiệu lực, giữ nguyên căn cứ.
//
// LƯU Ý: khi Nhà nước ban hành văn bản sửa đổi/thay thế các luật trên, chỉ cần
// sửa phần "Căn cứ" đầu mỗi mẫu, phần nội dung điều khoản không cần đổi.

export interface ContractTemplate {
  id: string;
  label: string;
  shortDesc: string;
  content: string;
}

export interface ContractSchedule {
  dayOfWeek: string; // 'Monday' | 'Tuesday' | ... | 'Sunday'
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
}


const HEADER_LINE_QUOC_HIEU = 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM';
const HEADER_LINE_TIEU_NGU = 'Độc lập - Tự do - Hạnh Phúc';
const HEADER_LINE_TITLE = 'HỢP ĐỒNG THUÊ MẶT BẰNG';

function isHeaderLine(rawLine: string): boolean {
  const line = rawLine.trim();
  if (line === '') return true;
  if (line === HEADER_LINE_QUOC_HIEU) return true;
  if (line === HEADER_LINE_TIEU_NGU) return true;
  if (/^-{5,}$/.test(line)) return true;
  if (line === HEADER_LINE_TITLE) return true;
  if (/^S[ốo]\s*:/i.test(line)) return true;
  return false;
}

/**
 * Tách nội dung hợp đồng thành 2 phần để hiển thị đúng thể thức văn bản:
 * - header: quốc hiệu, tiêu ngữ, tên hợp đồng, số hợp đồng -> phải canh GIỮA
 * - body: phần còn lại (Căn cứ..., các Điều...) -> canh TRÁI như bình thường
 * Nhận biết bằng cách dò các dòng đầu tiên khớp mẫu quốc hiệu/tiêu ngữ/số hợp
 * đồng; gặp dòng đầu tiên không khớp (vd "- Căn cứ...") thì dừng lại.
 */
export function splitContractHeaderBody(description: string): { header: string; body: string } {
  const lines = (description || '').split('\n');
  let idx = 0;
  while (idx < lines.length && isHeaderLine(lines[idx])) {
    idx++;
  }
  return {
    header: lines.slice(0, idx).join('\n').trim(),
    body: lines.slice(idx).join('\n'),
  };
}

// -----------------------------------------------------------------------
// LỊCH HOẠT ĐỘNG (contractSchedules) -> chuỗi hiển thị trong hợp đồng
// -----------------------------------------------------------------------

const DAY_LABELS_VI: Record<string, string> = {
  Monday: 'Thứ Hai',
  Tuesday: 'Thứ Ba',
  Wednesday: 'Thứ Tư',
  Thursday: 'Thứ Năm',
  Friday: 'Thứ Sáu',
  Saturday: 'Thứ Bảy',
  Sunday: 'Chủ Nhật',
};

// Thứ tự chuẩn trong tuần, dùng để sắp xếp lại danh sách ngày cho đẹp
// (tránh trường hợp người dùng tick CN trước, T2 sau mà hiển thị lộn xộn).
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Gom các ngày có CÙNG khung giờ (startTime-endTime) lại thành 1 nhóm để
 * hiển thị gọn, ví dụ:
 *   [T2 08:00-22:00, T4 08:00-22:00, CN 10:00-18:00]
 *   -> "Thứ Hai, Thứ Tư (08:00 - 22:00); Chủ Nhật (10:00 - 18:00)"
 * Nếu không có ngày nào (mảng rỗng/undefined) -> trả về chuỗi rỗng, để
 * renderMergeValue() tự hiện placeholder [...Lịch hoạt động...].
 */
export function formatSchedule(schedules?: ContractSchedule[]): string {
  if (!schedules || schedules.length === 0) return '';

  const groups: Record<string, string[]> = {};
  schedules.forEach((s) => {
    if (!s.dayOfWeek || !s.startTime || !s.endTime) return;
    const key = `${s.startTime}-${s.endTime}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s.dayOfWeek);
  });

  const parts = Object.entries(groups).map(([time, days]) => {
    const sortedDays = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const dayLabels = sortedDays.map((d) => DAY_LABELS_VI[d] || d).join(', ');
    const [start, end] = time.split('-');
    return `${dayLabels} (${start} - ${end})`;
  });

  return parts.join('; ');
}

// -----------------------------------------------------------------------
// DANH SÁCH MERGE FIELD DÙNG CHUNG CHO CẢ 3 MẪU
// Đặt tên khớp với các trường đã thấy trong màn hình "Chi Tiết Hợp Đồng"
// (Mặt bằng, Mã yêu cầu đặt thuê, Giá thuê, Tiền cọc, Thời hạn, Ngày bắt đầu,
// Diện tích, Mục đích kinh doanh, Lịch hoạt động...) để map 1-1 với dữ liệu
// trong DB của bạn.
// -----------------------------------------------------------------------
export interface ContractMergeData {
  // Liên kết / hệ thống
  MA_HOP_DONG?: string;          // số hợp đồng, vd "015/2026"
  MA_YEU_CAU_THUE?: string;      // mã yêu cầu đặt thuê, vd "#1"
  NGAY_LAP_HD?: string;          // ngày lập hợp đồng, vd "19/07/2026"
  DIA_DIEM_KY?: string;          // nơi ký, vd "TP. Hồ Chí Minh"

  // Mặt bằng
  TEN_MAT_BANG?: string;
  DIA_CHI_MAT_BANG?: string;
  DIEN_TICH?: string;            // vd "12 m2"
  MUC_DICH_KINH_DOANH?: string;
  LICH_HOAT_DONG?: string;       // vd "Thứ Hai, Thứ Tư (08:00 - 22:00); Chủ Nhật (10:00 - 18:00)"

  // Tài chính
  GIA_THUE?: string;             // vd "4.600.000 VNĐ/tháng"
  GIA_THUE_BANG_CHU?: string;
  TIEN_COC?: string;
  NGAY_THANH_TOAN_TU?: string;   // vd "mùng 1"
  NGAY_THANH_TOAN_DEN?: string;  // vd "mùng 5"

  // Thời hạn
  THOI_HAN_THUE?: string;        // vd "12 tháng" / "1 năm"
  NGAY_BAT_DAU?: string;
  NGAY_KET_THUC?: string;

  // Bên A - chủ mặt bằng (cá nhân hoặc công ty)
  BEN_A_HO_TEN?: string;
  BEN_A_CCCD?: string;
  BEN_A_CCCD_NGAY_CAP?: string;
  BEN_A_CCCD_NOI_CAP?: string;
  BEN_A_DIA_CHI?: string;
  BEN_A_TEN_CONG_TY?: string;
  BEN_A_GPKD?: string;
  BEN_A_MST?: string;
  BEN_A_DAI_DIEN?: string;

  // Bên B - người thuê (cá nhân hoặc công ty)
  BEN_B_HO_TEN?: string;
  BEN_B_CCCD?: string;
  BEN_B_CCCD_NGAY_CAP?: string;
  BEN_B_CCCD_NOI_CAP?: string;
  BEN_B_DIA_CHI?: string;
  BEN_B_TEN_CONG_TY?: string;
  BEN_B_GPKD?: string;
  BEN_B_MST?: string;
  BEN_B_DAI_DIEN?: string;
}

// Nhãn tiếng Việt hiển thị khi 1 field chưa có dữ liệu -> hiện dạng [...Nhãn...]
// thay vì dấu chấm chung chung, để (a) người soạn dễ biết còn thiếu chỗ nào,
// và (b) hệ thống có thể "tìm - thay" chính xác từng ô khi dữ liệu thay đổi.
const FIELD_LABELS: Record<string, string> = {
  MA_HOP_DONG: 'Số hợp đồng',
  MA_YEU_CAU_THUE: 'Mã yêu cầu thuê',
  NGAY_LAP_HD: 'Ngày lập hợp đồng',
  DIA_DIEM_KY: 'Nơi ký',
  TEN_MAT_BANG: 'Tên mặt bằng',
  DIA_CHI_MAT_BANG: 'Địa chỉ mặt bằng',
  DIEN_TICH: 'Diện tích',
  MUC_DICH_KINH_DOANH: 'Mục đích kinh doanh',
  LICH_HOAT_DONG: 'Lịch hoạt động',
  GIA_THUE: 'Giá thuê',
  GIA_THUE_BANG_CHU: 'Giá thuê bằng chữ',
  TIEN_COC: 'Tiền cọc',
  NGAY_THANH_TOAN_TU: 'Ngày thanh toán từ',
  NGAY_THANH_TOAN_DEN: 'Ngày thanh toán đến',
  THOI_HAN_THUE: 'Thời hạn thuê',
  NGAY_BAT_DAU: 'Ngày bắt đầu',
  NGAY_KET_THUC: 'Ngày kết thúc',
  BEN_A_HO_TEN: 'Họ tên Bên A',
  BEN_A_CCCD: 'CCCD Bên A',
  BEN_A_CCCD_NGAY_CAP: 'Ngày cấp CCCD Bên A',
  BEN_A_CCCD_NOI_CAP: 'Nơi cấp CCCD Bên A',
  BEN_A_DIA_CHI: 'Địa chỉ Bên A',
  BEN_A_TEN_CONG_TY: 'Tên công ty Bên A',
  BEN_A_GPKD: 'GPKD Bên A',
  BEN_A_MST: 'Mã số thuế Bên A',
  BEN_A_DAI_DIEN: 'Người đại diện Bên A',
  BEN_B_HO_TEN: 'Họ tên Bên B',
  BEN_B_CCCD: 'CCCD Bên B',
  BEN_B_CCCD_NGAY_CAP: 'Ngày cấp CCCD Bên B',
  BEN_B_CCCD_NOI_CAP: 'Nơi cấp CCCD Bên B',
  BEN_B_DIA_CHI: 'Địa chỉ Bên B',
  BEN_B_TEN_CONG_TY: 'Tên công ty Bên B',
  BEN_B_GPKD: 'GPKD Bên B',
  BEN_B_MST: 'Mã số thuế Bên B',
  BEN_B_DAI_DIEN: 'Người đại diện Bên B',
};

/**
 * Render giá trị hiển thị cho 1 merge field: giá trị thật nếu có, hoặc
 * placeholder dạng [...Nhãn...] nếu chưa có dữ liệu. Dùng chung bởi
 * fillContractTemplate() và bởi cơ chế "dò - thay" ở phía component.
 */
export function renderMergeValue(key: string, value?: string): string {
  if (value && value.trim().length > 0) return value;
  const label = FIELD_LABELS[key] || key;
  return `[…${label}…]`;
}

/**
 * Đổ dữ liệu thật vào mẫu hợp đồng: thay {{TEN_BIEN}} bằng giá trị tương ứng.
 * Biến nào không có dữ liệu sẽ hiện dạng [...Nhãn...] để chủ nhà biết còn thiếu
 * chỗ nào, đồng thời làm "chỗ neo" duy nhất để dò - thay chính xác sau này.
 */
export function fillContractTemplate(
  template: ContractTemplate,
  data: ContractMergeData
): string {
  return template.content.replace(/{{\s*([A-Z_]+)\s*}}/g, (_match, key: string) => {
    const value = (data as Record<string, string | undefined>)[key];
    return renderMergeValue(key, value);
  });
}

const TPL_CONG_CHUNG = `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh Phúc
-------------------------------

HỢP ĐỒNG THUÊ MẶT BẰNG
Số: {{MA_HOP_DONG}}

- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;
- Căn cứ Luật Kinh doanh bất động sản số 29/2023/QH15 ngày 28/11/2023 (hiệu lực từ 01/8/2024);
- Căn cứ Luật Nhà ở số 27/2023/QH15;
- Căn cứ Luật Công chứng số 46/2024/QH15 (hiệu lực từ 01/7/2025);
- Căn cứ nhu cầu thuê mặt bằng của Bên B, cũng như khả năng cho thuê mặt bằng của Bên A.

Hôm nay, ngày {{NGAY_LAP_HD}}, tại Văn phòng/Phòng công chứng ......................., trước mặt Công chứng viên, chúng tôi ký tên dưới đây, những người tự nhận thấy có đủ năng lực hành vi dân sự và tự chịu trách nhiệm trước pháp luật về mọi hành vi của mình, gồm:

BÊN A: (Bên cho thuê)
Ông/Bà: {{BEN_A_HO_TEN}}
Số CCCD/Định danh cá nhân: {{BEN_A_CCCD}}, cấp ngày: {{BEN_A_CCCD_NGAY_CAP}} tại: {{BEN_A_CCCD_NOI_CAP}}
Địa chỉ thường trú: {{BEN_A_DIA_CHI}}
Hoặc Công ty: {{BEN_A_TEN_CONG_TY}}
Địa chỉ: ..................
GPKD số: {{BEN_A_GPKD}}
Mã số thuế: {{BEN_A_MST}}
ĐT: ......................... Fax: ...............
Đại diện: Ông/Bà {{BEN_A_DAI_DIEN}} Chức vụ: ...............................

BÊN B: (Bên thuê)
Ông/Bà: {{BEN_B_HO_TEN}}
Số CCCD/Định danh cá nhân: {{BEN_B_CCCD}}, cấp ngày: {{BEN_B_CCCD_NGAY_CAP}} tại: {{BEN_B_CCCD_NOI_CAP}}
Địa chỉ thường trú: {{BEN_B_DIA_CHI}}
Hoặc Công ty: {{BEN_B_TEN_CONG_TY}}
Địa chỉ: ..................
GPKD số: {{BEN_B_GPKD}}
Mã số thuế: {{BEN_B_MST}}
ĐT: ......................... Fax: ...............
Đại diện: Ông/Bà {{BEN_B_DAI_DIEN}} Chức vụ: ...............................

Mã yêu cầu đặt thuê liên kết trên hệ thống: {{MA_YEU_CAU_THUE}}

Cùng thỏa thuận giao kết hợp đồng thuê mặt bằng với các nội dung sau:

Điều 1: Đối tượng hợp đồng
- Bên A đồng ý cho bên B thuê mặt bằng gồm:
- Mặt bằng: {{TEN_MAT_BANG}}, tại địa chỉ {{DIA_CHI_MAT_BANG}}, với diện tích là {{DIEN_TICH}}.
- Mục đích thuê: Kinh doanh {{MUC_DICH_KINH_DOANH}}.

Điều 2: Thời hạn thuê
- Thời hạn thuê là {{THOI_HAN_THUE}} kể từ ngày {{NGAY_BAT_DAU}} đến ngày {{NGAY_KET_THUC}}.
- Hết thời hạn thuê nêu trên, nếu hai bên có nhu cầu và muốn tiếp tục thực hiện hợp đồng thì sẽ cùng nhau thỏa thuận ký kết hợp đồng mới.
- Khi hết hạn hợp đồng mà hai bên không tiếp tục ký kết hợp đồng mới thì bên B phải trả lại mặt bằng cho bên A ngay khi chấm dứt hợp đồng thuê. Bên B sẽ có thời hạn là 30 ngày để dọn dẹp, vận chuyển tài sản, trang thiết bị của mình và phải trả lại mặt bằng thuê sau khi đã cải tạo, sửa chữa lại cho bên A.

Điều 3: Đơn giá và phương thức thanh toán
3.1 Giá cả
Giá thuê mặt bằng cố định kể từ khi ký Hợp đồng là: {{GIA_THUE}}. Bằng chữ: {{GIA_THUE_BANG_CHU}}.
Số tiền thuê nói trên không bao gồm các chi phí dịch vụ như: điện, nước, điện thoại, internet, fax, dọn vệ sinh... Các chi phí này sẽ do Bên B trực tiếp thanh toán hàng tháng với các cơ quan cung cấp dịch vụ kể từ sau ngày ký Hợp đồng này.
Giá trên không bao gồm thuế VAT, thuế môn bài, thuế nhà hoặc các loại thuế khác (Các chi phí này nếu phát sinh thì sẽ do bên thuê mặt bằng thanh toán theo quy định của pháp luật thuế hiện hành).
Thời điểm ký kết hợp đồng này thì bên cho thuê không được điều chỉnh giá thuê mặt bằng.

3.2 Phương thức thanh toán
- Tiền thuê mặt bằng sẽ được thanh toán từ ngày {{NGAY_THANH_TOAN_TU}} đến ngày {{NGAY_THANH_TOAN_DEN}} của mỗi tháng. Nếu Bên B thanh toán trễ sẽ tính theo lãi suất tiền gửi tiết kiệm kỳ hạn ..... tháng của ngân hàng nhân với số ngày trễ hạn.

Điều 4: Phạm vi hoạt động
- Bên B chỉ được sử dụng phần diện tích mặt bằng thuê vào việc kinh doanh mà bên B đã đăng ký.
- Bên B được phép trang trí, sửa chữa phần nội thất bên trong, ngoại thất bên ngoài mặt bằng để phù hợp với ngành nghề kinh doanh của bên B.
- Bên B được trang trí và treo bảng hiệu ở mặt tiền để phục vụ cho việc quảng bá và giới thiệu công việc kinh doanh của bên B, đảm bảo tuân thủ quy định về quảng cáo ngoài trời hiện hành.
- Bên B được phép hoạt động kinh doanh theo lịch sau: {{LICH_HOAT_DONG}}, trừ trường hợp pháp luật địa phương có quy định hạn chế khác.
- Bên B có thể tiến hành khảo sát, thiết kế mặt bằng ngay trong tháng ...., thời hạn giao mặt bằng trễ nhất là ................. . Thời điểm bắt đầu tính phí thuê mặt bằng là ngày {{NGAY_BAT_DAU}}.
Để sửa chữa và dỡ bỏ các hạng mục này Bên B đồng ý thanh toán cho bên A số tiền là ..................... đồng. Số tiền này được thanh toán ngay khi chấm dứt hợp đồng này.

Điều 5: Trách nhiệm của mỗi bên
5.1 Trách nhiệm của bên A
- Bàn giao mặt bằng cho Bên B sử dụng cùng các thiết bị đi kèm (kèm theo phụ lục) ngay sau khi ký hợp đồng.
- Bảo đảm quyền cho thuê hợp pháp, cung cấp đầy đủ thông tin, giấy tờ pháp lý của mặt bằng theo quy định tại Điều 16 Luật Kinh doanh bất động sản 2023 và cam kết không có bất kỳ tranh chấp, khiếu nại nào đối với mặt bằng cho Bên B thuê.
- Bảo đảm quyền sử dụng trọn vẹn và riêng rẽ của Bên B đối với phần diện tích cho thuê đã nói ở Điều 1.
- Tạo mọi điều kiện cho Bên B trong việc sử dụng mặt bằng, đảm bảo quyền sử dụng dịch vụ công cộng cho bên thuê B.
- Không được đơn phương chấm dứt hợp đồng trong suốt thời hạn thuê nếu không thống nhất được với bên B.
- Phối hợp và giúp đỡ bên thuê trong những vấn đề liên quan đến bên thứ ba nếu có phát sinh và pháp luật có quy định bắt buộc (mọi chi phí nếu có thuộc bên B).
- Không được tăng giá cho thuê trong suốt thời gian của hợp đồng thuê mặt bằng. Trường hợp hai bên tiếp tục hợp đồng theo thời hạn mới thì Bên A có thể điều chỉnh giá thuê theo giá thị trường tại thời điểm ký kết nhưng không được vượt quá 10% tổng giá trị hợp đồng trước đó.

5.2 Trách nhiệm của bên B
- Thanh toán đủ và đúng thời hạn cho bên A như đã ghi ở Điều 3.
- Đăng ký tạm trú/lưu trú cho nhân viên tại địa chỉ thuê theo quy định về cư trú hiện hành (nếu có).
- Thực hiện đầy đủ tất cả các nghĩa vụ về thuế và tài chính với cơ quan có thẩm quyền liên quan đến hoạt động kinh doanh và việc thực hiện hợp đồng này.
- Chịu trách nhiệm đăng ký kinh doanh và hoạt động kinh doanh theo đúng pháp luật và quy định của Nhà nước.
- Không kinh doanh các ngành nghề vi phạm pháp luật. Sử dụng diện tích thuê đúng mục đích đã cam kết. Trong quá trình sử dụng đảm bảo an ninh, an toàn phòng cháy chữa cháy và tuân thủ các quy định của pháp luật về vệ sinh môi trường.
- Tự quản lý và tự chịu trách nhiệm về tài sản của mình.
- Trong quá trình sử dụng, nếu bên B muốn sửa chữa, xây dựng hạng mục mới có ảnh hưởng đến kết cấu, kiến trúc của tài sản thuê thì phải bàn bạc với bên A và chỉ được thực hiện khi có sự đồng ý bằng văn bản của bên A.

Điều 6: Đặt cọc
- Để đảm bảo cho việc thực hiện hợp đồng này Bên B đặt cọc cho bên A số tiền là {{TIEN_COC}} khi tiến hành ký kết hợp đồng này.
- Toàn bộ số tiền đặt cọc sẽ được trả lại cho bên B sau khi hết hạn hợp đồng và trừ đi các khoản chi phí (nếu có). Nếu trong quá trình thực hiện hợp đồng, Bên B chấm dứt hợp đồng trước thời hạn thì mất số tiền cọc. Trường hợp Bên A chấm dứt hợp đồng trước thời hạn thì phải trả lại tiền cọc cho Bên B và trả thêm cho bên B số tiền đúng bằng ................................................... .

Điều 7: Thỏa thuận chung
Bên B có quyền đơn phương chấm dứt hợp đồng trong trường hợp Bên A vi phạm các điều khoản ghi trong Hợp đồng mà không thống nhất được giữa hai bên.
Trường hợp có phát sinh tranh chấp trong quá trình thực hiện Hợp đồng này, hai bên chủ động bàn bạc giải quyết trên cơ sở thương lượng, đàm phán theo quy định của Bộ luật Dân sự 2015. Nếu hai bên không thỏa thuận được thì tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định pháp luật tố tụng dân sự hiện hành.
Hợp đồng này gồm 07 điều, lập thành 02 bản, có giá trị pháp lý như nhau. Mỗi bên giữ 01 bản để thực hiện.
Hợp đồng này có hiệu lực kể từ ngày ký (hoặc kể từ ngày công chứng, nếu các bên lựa chọn công chứng theo Luật Công chứng 2024).

ĐẠI DIỆN BÊN A                                    ĐẠI DIỆN BÊN B`;

const TPL_CHUAN = `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh Phúc
-------------------------------

HỢP ĐỒNG THUÊ MẶT BẰNG
Số: {{MA_HOP_DONG}}

- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;
- Căn cứ Luật Kinh doanh bất động sản số 29/2023/QH15 ngày 28/11/2023 (hiệu lực từ 01/8/2024);
- Căn cứ Luật Nhà ở số 27/2023/QH15;
- Căn cứ nhu cầu và khả năng thực tế của hai bên.

Hôm nay, ngày {{NGAY_LAP_HD}} tại {{DIA_DIEM_KY}}.
Chúng tôi gồm:

BÊN CHO THUÊ MẶT BẰNG:
Họ tên: {{BEN_A_HO_TEN}}
CCCD/Định danh cá nhân số: {{BEN_A_CCCD}} cấp ngày: {{BEN_A_CCCD_NGAY_CAP}} tại {{BEN_A_CCCD_NOI_CAP}}
Thường trú: {{BEN_A_DIA_CHI}}
Là chủ sở hữu/người có quyền cho thuê mặt bằng tại: {{DIA_CHI_MAT_BANG}}
Căn cứ theo giấy chứng nhận quyền sở hữu/quyền sử dụng đất:
Số: ...................... do ...................... cấp ngày ......................
(Gọi tắt là bên A)

BÊN THUÊ MẶT BẰNG:
Họ tên: {{BEN_B_HO_TEN}}
CCCD/Định danh cá nhân số: {{BEN_B_CCCD}} cấp ngày: {{BEN_B_CCCD_NGAY_CAP}} tại {{BEN_B_CCCD_NOI_CAP}}
Thường trú: {{BEN_B_DIA_CHI}}
(Gọi tắt là bên B)

Mã yêu cầu đặt thuê liên kết trên hệ thống: {{MA_YEU_CAU_THUE}}

Hai bên thoả thuận ký kết hợp đồng thuê mặt bằng với nội dung sau:

ĐIỀU 1: Nội dung hợp đồng
1.1 - Bên A đồng ý cho bên B thuê mặt bằng: {{TEN_MAT_BANG}}, địa chỉ {{DIA_CHI_MAT_BANG}}.
Với diện tích là {{DIEN_TICH}}.

1.2 - Mục đích thuê: {{MUC_DICH_KINH_DOANH}}.
Lịch hoạt động: {{LICH_HOAT_DONG}}.

ĐIỀU 2: Thời hạn hợp đồng
2.1 - Thời hạn thuê mặt bằng là: {{THOI_HAN_THUE}}, được tính từ ngày: {{NGAY_BAT_DAU}} đến hết ngày: {{NGAY_KET_THUC}}.
2.2 - Trường hợp bên B không đóng phí thế chân thì bên A có quyền lấy lại mặt bằng với điều kiện phải báo cho bên B trước 03 tháng.
2.3 - Trường hợp bên B đóng phí thế chân thì bên A phải thực hiện theo đúng thời hạn hợp đồng đã nêu trên.
2.4 - Sau khi hết hạn hợp đồng, tuỳ theo nhu cầu thực tế hai bên có thể thoả thuận về việc gia hạn hoặc chấm dứt hợp đồng thuê.

ĐIỀU 3: Giá cả - Phương thức thanh toán
3.1 - Giá thuê mặt bằng là: {{GIA_THUE}}. Tiền đặt cọc (nếu có): {{TIEN_COC}}.
3.2 - Trong trường hợp bên B chậm trả tiền thuê mặt bằng sau một tháng thì hợp đồng thuê mặt bằng này đương nhiên chấm dứt trước thời hạn và hai bên tiến hành thanh lý hợp đồng. Bên B phải giao trả lại cho bên A toàn bộ mặt bằng và các trang thiết bị theo tình trạng ban đầu.
3.3 - Trường hợp bên A lấy lại mặt bằng trước thời hạn mà không thoả các điều kiện ở ĐIỀU 2 thì bên A phải bồi thường lại cho bên B toàn bộ chi phí bên B đã đầu tư trang thiết bị và các khoản tiền thuê mặt bằng của thời gian còn lại trong hợp đồng.
3.4 - Theo định kỳ 01 năm, giá thuê mặt bằng có thể điều chỉnh tăng thêm tối đa 10% so với giá hiện hành tại thời điểm đó, theo thỏa thuận của hai bên.

ĐIỀU 4: Trách nhiệm của hai bên
4.1 - Trách nhiệm của bên A:
4.1.1 - Bên A cam kết bảo đảm quyền sử dụng trọn vẹn hợp pháp, cung cấp đầy đủ thông tin và giấy tờ pháp lý của mặt bằng theo Điều 16 Luật Kinh doanh bất động sản 2023, tạo mọi điều kiện thuận lợi để bên B sử dụng mặt bằng hiệu quả.
4.1.2 - Bên A sẽ bàn giao toàn bộ các trang thiết bị, đồ dùng hiện có như đã thoả thuận ngay sau khi ký kết hợp đồng này.

4.2 - Trách nhiệm của bên B:
4.2.1 - Sử dụng mặt bằng đúng mục đích thuê, khi cần sửa chữa cải tạo theo nhu cầu sử dụng riêng sẽ bàn bạc cụ thể với bên A và phải được bên A chấp thuận bằng văn bản, tuân thủ các quy định về xây dựng hiện hành. Các chi phí sửa chữa này bên B tự chi trả, bên A không hoàn lại khi hết hợp đồng thuê.
4.2.2 - Thanh toán tiền thuê mặt bằng đúng thời hạn.
4.2.3 - Chịu trách nhiệm về mọi hoạt động sản xuất kinh doanh của mình theo đúng pháp luật hiện hành.
4.2.4 - Chấp hành các quy định về giữ gìn vệ sinh môi trường và trật tự an ninh chung trong khu vực kinh doanh.
4.2.5 - Được phép chuyển nhượng hợp đồng thuê mặt bằng hoặc cho người khác thuê lại sau khi thoả thuận và được sự đồng ý bằng văn bản của bên A.
4.2.6 - Thanh toán các khoản chi phí phát sinh trong kinh doanh (ngoài tiền thuê nhà ghi ở ĐIỀU 3) như tiền điện, nước, điện thoại, thuế kinh doanh... đầy đủ và đúng thời hạn.
4.2.7 - Trước khi chấm dứt hợp đồng thuê mặt bằng, bên B phải thanh toán hết tiền điện, nước, điện thoại, thuế kinh doanh... và giao lại mặt bằng cho bên A.
4.2.8 - Khi hai bên chấm dứt hợp đồng thuê mặt bằng thì bên B phải trả lại mặt bằng đã thuê theo đúng hiện trạng ban đầu, không được đập phá hay tháo dỡ bất cứ vật dụng nào mà bên A cho mượn.

ĐIỀU 5: Cam kết chung
Hai bên cam kết thực hiện đúng các điều khoản đã ghi trong hợp đồng. Nếu có xảy ra tranh chấp hoặc có một bên vi phạm hợp đồng thì hai bên sẽ giải quyết thông qua thương lượng theo quy định của Bộ luật Dân sự 2015. Trong trường hợp không tự giải quyết được, hai bên sẽ đưa vụ việc ra giải quyết tại Toà án nhân dân có thẩm quyền. Quyết định của Toà án là quyết định cuối cùng mà hai bên phải chấp hành, mọi phí tổn sẽ do bên có lỗi chịu.
Hợp đồng được lập thành 02 bản, có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện.

ĐẠI DIỆN BÊN A                                    ĐẠI DIỆN BÊN B`;

const TPL_DON_GIAN = `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh Phúc
-------------------------------

HỢP ĐỒNG THUÊ MẶT BẰNG
Số: {{MA_HOP_DONG}}

- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;
- Căn cứ Luật Kinh doanh bất động sản số 29/2023/QH15 ngày 28/11/2023 (hiệu lực từ 01/8/2024);
- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/6/2005;
- Căn cứ vào khả năng và nhu cầu của hai bên.

Hôm nay, ngày {{NGAY_LAP_HD}} tại {{DIA_DIEM_KY}}.
Chúng tôi gồm:

BÊN CHO THUÊ MẶT BẰNG (Gọi tắt là Bên A)
Họ tên: {{BEN_A_HO_TEN}}
CCCD/Định danh cá nhân số: {{BEN_A_CCCD}} cấp ngày: {{BEN_A_CCCD_NGAY_CAP}} tại {{BEN_A_CCCD_NOI_CAP}}
Thường trú: {{BEN_A_DIA_CHI}}
Là chủ sở hữu/người có quyền cho thuê mặt bằng tại: {{DIA_CHI_MAT_BANG}}
Căn cứ theo giấy chứng nhận quyền sở hữu/quyền sử dụng đất số ........... do .......... cấp ngày ...................

BÊN THUÊ MẶT BẰNG: (Gọi tắt là Bên B)
Họ tên: {{BEN_B_HO_TEN}}
CCCD/Định danh cá nhân số: {{BEN_B_CCCD}} cấp ngày: {{BEN_B_CCCD_NGAY_CAP}} tại {{BEN_B_CCCD_NOI_CAP}}
Thường trú: {{BEN_B_DIA_CHI}}

Mã yêu cầu đặt thuê liên kết trên hệ thống: {{MA_YEU_CAU_THUE}}

Hai bên thoả thuận ký kết hợp đồng thuê mặt bằng với nội dung sau:

ĐIỀU 1: Nội dung hợp đồng
- Bên A đồng ý cho bên B thuê mặt bằng: {{TEN_MAT_BANG}}, tại {{DIA_CHI_MAT_BANG}}.
Với diện tích là: {{DIEN_TICH}}.
- Mục đích thuê: {{MUC_DICH_KINH_DOANH}}.
- Lịch hoạt động: {{LICH_HOAT_DONG}}.

ĐIỀU 2: Thời hạn hợp đồng
- Thời hạn thuê mặt bằng là: {{THOI_HAN_THUE}}.
- Được tính từ ngày: {{NGAY_BAT_DAU}} đến hết ngày: {{NGAY_KET_THUC}}.
- Sau khi hết hạn hợp đồng, tuỳ theo nhu cầu thực tế hai bên có thể thoả thuận về việc gia hạn hoặc chấm dứt hợp đồng thuê.

ĐIỀU 3: Giá cả - Phương thức thanh toán
- Giá thuê mặt bằng là: {{GIA_THUE}}.
- Tiền đặt cọc (nếu có): {{TIEN_COC}}.
- Phương thức thanh toán: chuyển khoản/tiền mặt vào ngày {{NGAY_THANH_TOAN_TU}} hàng tháng.
- Theo định kỳ 01 năm, giá thuê mặt bằng có thể điều chỉnh tăng thêm tối đa 15% so với giá hiện hành tại thời điểm đó, theo thỏa thuận của hai bên.

ĐIỀU 4: Trách nhiệm của hai bên
4.1 - Trách nhiệm của bên A:
- Bên A cam kết sẽ bảo đảm quyền sử dụng hợp pháp, cung cấp đầy đủ thông tin và giấy tờ pháp lý của mặt bằng, tạo mọi điều kiện thuận lợi để bên B sử dụng mặt bằng kinh doanh hiệu quả.
- Bên A sẽ bàn giao toàn bộ mặt bằng và nội thất đã có như đã thoả thuận ngay sau khi ký kết hợp đồng này.

4.2 - Trách nhiệm của bên B:
- Bên B sẽ sử dụng mặt bằng đúng mục đích kinh doanh, khi có nhu cầu sửa chữa cải tạo thì phải được bên A đồng ý bằng văn bản và tuân thủ các quy định về xây dựng hiện hành. Mọi chi phí sửa chữa do bên B tự chi trả.
- Thanh toán tiền thuê mặt bằng đúng hạn theo Điều 3.
- Chịu trách nhiệm về hoạt động kinh doanh của mình theo đúng pháp luật hiện hành.
- Giữ gìn vệ sinh môi trường và trật tự an ninh chung trong khu vực kinh doanh.
- Trước khi chấm dứt hợp đồng thuê mặt bằng, bên B phải thanh toán hết tiền điện, nước và giao lại mặt bằng cho bên A.
- Khi hai bên chấm dứt hợp đồng thuê mặt bằng thì bên B phải trả lại mặt bằng và nội thất đã thuê theo đúng hiện trạng ban đầu, không được đập phá hay tháo dỡ bất cứ vật dụng nào mà bên A cho mượn.

ĐIỀU 5: Cam kết chung
Hai bên cam kết thực hiện đúng các điều khoản đã ghi trong hợp đồng. Nếu có xảy ra tranh chấp hoặc có một bên vi phạm hợp đồng thì hai bên sẽ giải quyết thông qua thương lượng theo quy định của Bộ luật Dân sự 2015. Trong trường hợp không thương lượng được, Toà án nhân dân có thẩm quyền sẽ giải quyết theo quy định pháp luật tố tụng dân sự.

ĐIỀU 6: Hiệu lực hợp đồng
Hợp đồng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.
Hợp đồng có hiệu lực kể từ ngày ký.

ĐẠI DIỆN BÊN A                                    ĐẠI DIỆN BÊN B`;

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'cong_chung',
    label: 'Mẫu công chứng (đầy đủ)',
    shortDesc: '7 điều, có phần công chứng, đặt cọc, phạm vi hoạt động chi tiết — cập nhật Luật KDBĐS 2023 & Luật Công chứng 2024',
    content: TPL_CONG_CHUNG,
  },
  {
    id: 'chuan',
    label: 'Mẫu chuẩn',
    shortDesc: '5 điều, không công chứng, tăng giá tối đa 10%/năm — cập nhật Luật KDBĐS 2023',
    content: TPL_CHUAN,
  },
  {
    id: 'don_gian',
    label: 'Mẫu rút gọn',
    shortDesc: '6 điều ngắn gọn, tăng giá tối đa 15%/năm — cập nhật Luật KDBĐS 2023',
    content: TPL_DON_GIAN,
  },
];

export const getTemplateById = (id: string) =>
  CONTRACT_TEMPLATES.find((t) => t.id === id);