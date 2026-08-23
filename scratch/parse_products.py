import json
import re

with open('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/main_bundle.js', 'r', encoding='utf-8') as f:
    js = f.read()

pos = js.find('slug:')
print('Pos of slug:', pos)
if pos != -1:
    start = js.rfind('[', 0, pos)
    print('Start of array:', start)
    # Find matching closing bracket
    bracket_count = 0
    end = start
    for i in range(start, len(js)):
        if js[i] == '[':
            bracket_count += 1
        elif js[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                end = i + 1
                break
    chunk = js[start:end]
    print('Found chunk length:', len(chunk))
    with open('C:/Users/petrm/.gemini/antigravity-ide/brain/8bf215bc-e1aa-498e-8057-89a4badbf56a/scratch/products_array.txt', 'w', encoding='utf-8') as pf:
        pf.write(chunk)
