"""Decrypt a downloaded object to a local pg_restore archive; never connects to a database."""
import base64,json,os,sys
from pathlib import Path
from backup import decrypt,read_bundle
if len(sys.argv)!=3:raise SystemExit('Usage: python3 recover.py encrypted.enc output.pgdump')
source,target=map(Path,sys.argv[1:])
if target.exists():raise SystemExit('Output already exists; refusing to overwrite')
dump,manifest=read_bundle(decrypt(source.read_bytes(),base64.b64decode(os.environ['BACKUP_ENCRYPTION_KEY'],validate=True)))
with target.open('xb') as f:f.write(dump)
os.chmod(target,0o600)
target.with_suffix(target.suffix+'.manifest.json').write_text(json.dumps(manifest,indent=2))
print('Authenticated decryption and archive checksum verified; no database modified.')
