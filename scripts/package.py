"""Build a portable Chrome extension ZIP using only Python's standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source = root / 'extension'
manifest = json.loads((source / 'manifest.json').read_text())
files = ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'page.js']
output = root / 'dist'
output.mkdir(exist_ok=True)
archive = output / 'minti-chrome.zip'
with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as bundle:
    for name in files:
        bundle.write(source / name, 'minti-chrome/' + name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert set(bundle.namelist()) == {'minti-chrome/' + name for name in files}
    for name in files:
        assert bundle.read('minti-chrome/' + name) == (source / name).read_bytes()
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  minti-chrome.zip\n')
print(f'Validated Minti {manifest["version"]}: {archive}')
