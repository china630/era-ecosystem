from pathlib import Path

content = r'''use client placeholder'''

Path('scripts/_tmp_utf8/py-write-test.txt').write_text('hello-from-py\n', encoding='utf-8', newline='\n')
b = Path('scripts/_tmp_utf8/py-write-test.txt').read_bytes()
print(b, 'null_at_1', b[1] if len(b)>1 else None)
