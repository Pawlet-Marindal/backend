// Ubah "YYYY-MM" jadi rentang waktu SQL + jumlah hari dalam bulan.
const resolveMonth = (rawMonth) => {
  const fallback = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(String(rawMonth || '')) ? String(rawMonth) : fallback;
  const [year, monthNumber] = month.split('-').map(Number);

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const toSql = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

  return {
    month,
    start: toSql(start),
    end: toSql(end),
    daysInMonth,
    shift: (offset) => {
      const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
      return {
        start: toSql(shifted),
        end: toSql(new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1))),
      };
    },
  };
};

const percentChange = (current, previous) => {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return ((c - p) / Math.abs(p)) * 100;
};

module.exports = { resolveMonth, percentChange };
