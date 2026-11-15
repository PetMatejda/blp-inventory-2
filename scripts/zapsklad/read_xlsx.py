# Reads the ZapSklad Excel export (sheets Balloon, Electro, Accessories) into JSON.
# Usage: python -I scripts/zapsklad/read_xlsx.py "<file.xlsx>" <out.json>
import zipfile, re, sys, json
import xml.etree.ElementTree as ET
p=sys.argv[1]; z=zipfile.ZipFile(p)
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ss=[ ''.join(t.text or '' for t in si.iter('{%s}t'%ns['m'])) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
def col(c): 
    n=0
    for ch in re.match(r'[A-Z]+',c).group(): n=n*26+ord(ch)-64
    return n-1
out={}
for name,f in [('Balloon','sheet1'),('Electro','sheet2'),('Accessories','sheet3')]:
    rows=[]
    for r in ET.fromstring(z.read(f'xl/worksheets/{f}.xml')).iter('{%s}row'%ns['m']):
        row={}
        for c in r.findall('m:c',ns):
            v=c.find('m:v',ns); 
            if v is None:
                isv=c.find('.//m:t',ns); val=isv.text if isv is not None else None
            else:
                val=ss[int(v.text)] if c.get('t')=='s' else v.text
            if val not in (None,''): row[col(c.get('r'))]=val
        if row: rows.append(row)
    out[name]=rows
json.dump(out,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False)
if False:
    print('##',k,len(v))
    for r in v[:12]: print(r)
