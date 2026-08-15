export const getPriceUnitText = (priceUnit: string | undefined | null) => {
  switch (priceUnit) {
    case 'PerHour': return 'giờ';
    case 'PerDay': return 'ngày';
    case 'PerWeek': return 'tuần';
    case 'PerMonth': return 'tháng';
    case 'PerYear': return 'năm';
    default: return 'giờ';
  }
};
