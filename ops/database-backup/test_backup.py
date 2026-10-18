import unittest,io,json,zipfile,hashlib
from cryptography.exceptions import InvalidTag
from backup import encrypt,decrypt,read_bundle
class BackupIntegrityTests(unittest.TestCase):
 def test_authenticated_encryption_rejects_tampering(self):
  key=bytes(range(32));cipher=encrypt(b'private backup',key);changed=bytearray(cipher);changed[-1]^=1
  with self.assertRaises(InvalidTag):decrypt(bytes(changed),key)
  with self.assertRaises(InvalidTag):decrypt(cipher,b'x'*32)
  self.assertEqual(decrypt(cipher,key),b'private backup')
 def test_damaged_dump_rejected(self):
  out=io.BytesIO()
  with zipfile.ZipFile(out,'w') as z:
   z.writestr('database.pgdump',b'PGDMPcorrupted');z.writestr('manifest.json',json.dumps({'dumpSha256':hashlib.sha256(b'original').hexdigest()}))
  with self.assertRaises(ValueError):read_bundle(out.getvalue())
 def test_unexpected_archive_entries_rejected(self):
  out=io.BytesIO()
  with zipfile.ZipFile(out,'w') as z:z.writestr('../unexpected',b'data')
  with self.assertRaises(ValueError):read_bundle(out.getvalue())
if __name__=='__main__':unittest.main()
