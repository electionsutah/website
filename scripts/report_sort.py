"""Click-to-sort table headers for the HTML review reports in tmp/.

Insert SORTABLE (a <style> and <script> block) anywhere in a report's HTML.
Every table's header cells become sort buttons: first click sorts ascending,
second descending. Cells sort by their data-sort attribute when present,
otherwise by their text; numbers like "1,234" and "45%" sort numerically and
blank cells ("—") always go last. Rows with data-pin stay at the top.
"""

SORTABLE = '''<style>
thead th{cursor:pointer;user-select:none}thead th:hover{text-decoration:underline}
thead th[aria-sort]::after{margin-left:4px;font-size:9px}thead th[aria-sort=ascending]::after{content:"▲"}thead th[aria-sort=descending]::after{content:"▼"}
</style>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const value = cell => {
    const text = (cell?.dataset.sort ?? cell?.textContent ?? '').trim();
    if (!text || text === '—' || text === 'n/a') return null;
    const number = text.replace(/[,%$]/g, '');
    return /^-?\\d+(\\.\\d+)?$/.test(number) ? Number(number) : text.toLowerCase();
  };
  for (const table of document.querySelectorAll('table')) {
    const headers = [...table.tHead.rows[0].cells];
    headers.forEach((header, column) => {
      header.title = 'Sort by this column';
      header.addEventListener('click', () => {
        const ascending = header.getAttribute('aria-sort') !== 'ascending';
        headers.forEach(other => other.removeAttribute('aria-sort'));
        header.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
        for (const body of table.tBodies) {
          const rows = [...body.rows];
          const pinned = rows.filter(row => 'pin' in row.dataset);
          const sorted = rows.filter(row => !('pin' in row.dataset)).sort((a, b) => {
            const x = value(a.cells[column]), y = value(b.cells[column]);
            if (x === null || y === null) return (x === null) - (y === null);
            const order = typeof x === typeof y ? (x < y ? -1 : x > y ? 1 : 0) : (typeof x === 'number' ? -1 : 1);
            return ascending ? order : -order;
          });
          body.append(...pinned, ...sorted);
        }
      });
    });
  }
});
</script>'''
