# Reads the Comsys report "Přehled evidenčních čísel" (.xls, one sheet) into JSON rows.
# Needs xlrd (pip install xlrd).
# Usage: python -I scripts/comsys/read_xls.py "<file.xls>" <rows.json> [<dir with xlrd>]
import sys, json, re
if len(sys.argv) > 3:
    sys.path.insert(0, sys.argv[3])
import xlrd

wb = xlrd.open_workbook(sys.argv[1])
sh = wb.sheets()[0]
COLS = {'zn': 0, 'ev': 1, 'location': 8, 'note': 9, 'insertedBy': 10, 'inserted': 11, 'group': 12, 'text': 14}

rows = []
for r in range(sh.nrows):
    cells = [sh.cell_value(r, c) for c in range(sh.ncols)]
    if re.fullmatch(r'\d{6}', str(cells[0])) and re.fullmatch(r'\d{6}', str(cells[1])):
        row = {k: cells[i] for k, i in COLS.items()}
        row['inserted'] = xlrd.xldate_as_datetime(row['inserted'], wb.datemode).strftime('%Y-%m-%d') if row['inserted'] else ''
        row['text'] = str(row['text']).strip()
        row['line'] = r + 1
        rows.append(row)
    elif rows and not cells[0] and cells[9]:
        # A note that did not fit on the printed page continues on the next row.
        rows[-1]['note'] += '\n' + cells[9]

json.dump(rows, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(rows), 'rows')
