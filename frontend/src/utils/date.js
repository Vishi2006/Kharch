// Date formatting helpers

// Format any Date to "DD-MM-YYYY"
export const formatDateDMY = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format any Date to "MM-YYYY"
export const formatDateMY = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}-${year}`;
};

// Format YYYY-MM string to MM-YYYY (for API response displays)
export const formatMonthToMY = (ymStr) => {
  if (!ymStr || typeof ymStr !== 'string' || !ymStr.includes('-')) return ymStr;
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const [y, m] = parts;
  return `${m}-${y}`;
};

// Parse MM-YYYY back to YYYY-MM (for API requests)
export const parseMonthFromMY = (myStr) => {
  if (!myStr || typeof myStr !== 'string' || !myStr.includes('-')) return myStr;
  const parts = myStr.split('-');
  if (parts.length < 2) return myStr;
  const [m, y] = parts;
  return `${y}-${m}`;
};
