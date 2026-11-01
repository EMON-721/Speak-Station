import {execFileSync} from 'node:child_process';

// Check the Git index rather than the filesystem: .gitignore cannot protect an
// already tracked file, and ignored local databases must remain outside Git.
export function privateFile(path){
 const normalized=path.replaceAll('\\','/'),base=normalized.split('/').at(-1);
 if(base==='.env.example'||base?.endsWith('.env.example'))return false;
 return /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.wrangler|\.sites-runtime|backups?|dumps?|private|credentials)(?:\/|$)/i.test(normalized)
  ||/\.(?:db|sqlite3?)(?:-(?:wal|shm|journal))?$/i.test(base)
  ||/\.(?:pem|key|p12|pfx|keystore|jks|log)(?:\..*)?$/i.test(base)
  ||/\.(?:sql|db|sqlite3?)\.(?:gz|zip|tar|bz2|xz)$/i.test(base)
  ||/^(?:credentials|service[-_]?account|user[-_]?(?:backup|export)|learner[-_]?(?:backup|export)|database[-_]?dump|id_rsa|id_ed25519)(?:\.|$)/i.test(base)
  ||/^wrangler\.cloudflare\.(?:generated\.jsonc|setup\.generated\.json)$/.test(normalized)
  ||/^(?:dist|artifacts|test-results|playwright-report)\//.test(normalized);
}
export function checkPrivateFiles(){
 const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const forbidden=paths.filter(privateFile);
 if(forbidden.length){console.error('Private or generated artifacts must be removed from Git (file names only):\n'+forbidden.join('\n'));return false;}
 console.log('PASS: '+paths.length+' tracked paths contain no credential files, database files, backups or logs.');return true;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)process.exitCode=checkPrivateFiles()?0:1;
