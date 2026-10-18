"""Encrypted pg_dump backups; every run restores the downloaded object locally.
Production is read through a restricted backup role. Restore targets are private
Unix sockets in an ephemeral directory, never a production connection string.
"""
import base64
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
from urllib.parse import urlsplit, unquote
import zipfile

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import psycopg2
from psycopg2 import sql

HEADER = b'NOORPG01'
PREFIX = 'noor-postgres/v1/'
MAX_BYTES = int(os.getenv('BACKUP_MAX_ARCHIVE_BYTES', str(256 * 1024 * 1024)))

def emit(event, **fields):
    print(json.dumps({'event':event, **fields}, sort_keys=True), flush=True)

def run(args, env=None, timeout=300):
    result = subprocess.run(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        # Do not print connection strings, SQL data, or subprocess environments.
        raise RuntimeError(f'{Path(args[0]).name} failed with exit {result.returncode}')
    return result.stdout

def source_env():
    u = urlsplit(os.environ['BACKUP_DATABASE_URL'])
    if u.scheme not in ('postgres', 'postgresql') or not u.hostname or not u.path.strip('/'):
        raise ValueError('Invalid backup source')
    env = os.environ.copy()
    env.update(PGHOST=u.hostname, PGPORT=str(u.port or 5432), PGUSER=unquote(u.username or ''),
               PGPASSWORD=unquote(u.password or ''), PGDATABASE=unquote(u.path.lstrip('/')),
               PGCONNECT_TIMEOUT='15', PGSSLMODE='require',
               PGOPTIONS='-c statement_timeout=300000 -c lock_timeout=15000')
    return env

def connect_env(env):
    return psycopg2.connect(host=env['PGHOST'], port=env['PGPORT'], user=env['PGUSER'],
                           password=env.get('PGPASSWORD',''), dbname=env['PGDATABASE'],
                           sslmode=env.get('PGSSLMODE','require'), connect_timeout=15)

def counts(conn):
    result = {}
    with conn.cursor() as cur:
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        names = [r[0] for r in cur.fetchall()]
        for table in names:
            cur.execute(sql.SQL('SELECT count(*) FROM {}.{}').format(sql.Identifier('public'),sql.Identifier(table)))
            result[table] = cur.fetchone()[0]
    return result

def encrypt(data, key):
    nonce=secrets.token_bytes(12)
    return HEADER+nonce+AESGCM(key).encrypt(nonce,data,HEADER)

def decrypt(data,key):
    if not data.startswith(HEADER) or len(data)<len(HEADER)+28:
        raise ValueError('Invalid encrypted archive')
    n=len(HEADER)
    return AESGCM(key).decrypt(data[n:n+12],data[n+12:],HEADER)

def read_bundle(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if set(z.namelist()) != {'database.pgdump','manifest.json'}:
            raise ValueError('Unexpected archive entries')
        if sum(i.file_size for i in z.infolist()) > MAX_BYTES:
            raise ValueError('Archive exceeds safety limit')
        dump=z.read('database.pgdump'); manifest=json.loads(z.read('manifest.json'))
    if not dump.startswith(b'PGDMP') or hashlib.sha256(dump).hexdigest()!=manifest['dumpSha256']:
        raise ValueError('Dump checksum mismatch')
    return dump,manifest

def restore_check(dump,expected,root):
    # Independent local Postgres: no TCP listener and no source URL can be used.
    target=root/'restore-cluster';sock=root/'restore-socket';sock.mkdir(mode=0o700)
    env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=str(sock),PGPORT='55432',PGUSER='postgres',PGDATABASE='postgres',PGSSLMODE='disable')
    run(['initdb','-D',str(target),'--username=postgres','--auth=trust','--no-locale','--encoding=UTF8'],env)
    started=False
    try:
        run(['pg_ctl','-D',str(target),'-l',str(root/'restore.log'),'-o',f"-c listen_addresses='' -k {sock} -p 55432 -c fsync=off",'-w','start'],env)
        started=True
        archive=root/'downloaded.pgdump';archive.write_bytes(dump)
        run(['pg_restore','--exit-on-error','--no-owner','--no-acl','--dbname=postgres',str(archive)],env)
        conn=connect_env(env)
        try:
            actual=counts(conn)
            if actual!=expected:
                raise ValueError('Restore table counts do not match source snapshot')
        finally:conn.close()
        emit('restore_verified',tables=len(actual),rows=sum(actual.values()))
    finally:
        if started:run(['pg_ctl','-D',str(target),'-m','immediate','-w','stop'],env,timeout=60)

def client():
    return boto3.client('s3',endpoint_url=os.environ['BACKUP_S3_ENDPOINT'],
                        region_name=os.getenv('BACKUP_S3_REGION','auto'),
                        aws_access_key_id=os.environ['BACKUP_S3_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['BACKUP_S3_SECRET_ACCESS_KEY'],
                        config=Config(signature_version='s3v4',s3={'addressing_style':'path'},
                                      retries={'max_attempts':4,'mode':'standard'}))

def prune(s3,bucket,now,retention):
    cutoff=now-dt.timedelta(days=retention)
    doomed=[]
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket,Prefix=PREFIX):
        for obj in page.get('Contents',[]):
            if obj['Key'].endswith('.enc') and obj['LastModified']<cutoff:
                doomed.append({'Key':obj['Key']})
    for i in range(0,len(doomed),1000):
        result=s3.delete_objects(Bucket=bucket,Delete={'Objects':doomed[i:i+1000],'Quiet':True})
        if result.get('Errors'):raise RuntimeError('Retention cleanup failed')
    emit('retention_completed',removed=len(doomed),retentionDays=retention)

def main():
    start=time.monotonic();now=dt.datetime.now(dt.timezone.utc)
    key=base64.b64decode(os.environ['BACKUP_ENCRYPTION_KEY'],validate=True)
    if len(key)!=32:raise ValueError('Encryption key must contain 32 bytes')
    retention=int(os.getenv('BACKUP_RETENTION_DAYS','14'))
    if not 7<=retention<=90:raise ValueError('Retention must be 7..90 days')
    env=source_env();s3=client();bucket=os.environ['BACKUP_BUCKET']
    with tempfile.TemporaryDirectory(prefix='noor-backup-') as tmp:
        root=Path(tmp);os.chmod(root,0o700);dumpfile=root/'database.pgdump'
        conn=connect_env(env)
        try:
            conn.set_session(isolation_level='REPEATABLE READ',readonly=True)
            with conn.cursor() as cur:
                cur.execute('SELECT pg_export_snapshot(),current_setting(\'server_version_num\')::int')
                snapshot,version=cur.fetchone()
            if version//10000!=18:raise ValueError('Review PostgreSQL client/source version compatibility')
            expected=counts(conn)
            if not expected.get('surahs') or expected.get('ayahs')!=6236 or '_prisma_migrations' not in expected:
                raise ValueError('Source database content sanity check failed')
            run(['pg_dump','--format=custom','--compress=6','--no-owner','--no-acl',
                 '--lock-wait-timeout=15s','--snapshot='+snapshot,'--file='+str(dumpfile)],env,timeout=600)
            conn.commit()
        finally:conn.close()
        dump=dumpfile.read_bytes()
        if len(dump)>MAX_BYTES:raise ValueError('Backup too large for configured memory safety limit')
        manifest={'formatVersion':1,'createdAt':now.isoformat(),'serverVersion':version,
                  'dumpSha256':hashlib.sha256(dump).hexdigest(),'tableCounts':expected,
                  'globalRolesIncluded':False}
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w',compression=zipfile.ZIP_STORED) as z:
            z.writestr('database.pgdump',dump);z.writestr('manifest.json',json.dumps(manifest,sort_keys=True))
        encrypted=encrypt(stream.getvalue(),key)
        object_key=PREFIX+now.strftime('%Y/%m/%d/%Y%m%dT%H%M%SZ')+'-'+secrets.token_hex(4)+'.enc'
        sha=hashlib.sha256(encrypted).hexdigest()
        s3.put_object(Bucket=bucket,Key=object_key,Body=encrypted,ContentType='application/octet-stream',Metadata={'sha256':sha})
        response=s3.get_object(Bucket=bucket,Key=object_key);downloaded=response['Body'].read(MAX_BYTES+1024*1024);response['Body'].close()
        if hashlib.sha256(downloaded).hexdigest()!=sha:raise ValueError('Downloaded object checksum mismatch')
        restored_dump,restored_manifest=read_bundle(decrypt(downloaded,key))
        restore_check(restored_dump,restored_manifest['tableCounts'],root)
        marker={'completedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'objectKey':object_key,
                'encryptedSha256':sha,'encryptedBytes':len(encrypted),'restoreVerified':True,
                'tables':len(expected),'durationSeconds':round(time.monotonic()-start,2)}
        s3.put_object(Bucket=bucket,Key=PREFIX+'latest-success.json',Body=json.dumps(marker).encode(),ContentType='application/json')
        # Never delete historical copies until a new uploaded copy restores successfully.
        prune(s3,bucket,now,retention)
        emit('backup_completed',**marker)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        emit('backup_failed',errorType=type(exc).__name__)
        raise SystemExit(1)
