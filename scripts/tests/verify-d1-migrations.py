#!/usr/bin/env python3
"""Verify all historical D1 SQLite migrations on a disposable in-memory database."""
import pathlib, sqlite3, json, datetime, uuid
conn=sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys=ON')
files=sorted(pathlib.Path('drizzle').glob('*.sql'))
assert len(files)>=7, 'Migrations missing'
for path in files:
    statements=path.read_text().replace('--> statement-breakpoint','').strip()
    conn.executescript(statements)
tables={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required={'attempts','audit','days','question_overrides','profiles','saved','tests','usage','settings','messages','user_access','question_cooldowns','study_sessions'}
assert required.issubset(tables),f'Missing tables: {required-tables}'
cols=lambda table:{r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')}
assert {'user_id','name','target','track','exam_date','phone','created_at'}.issubset(cols('profiles'))
assert {'user_id','question_id','available_at'}.issubset(cols('question_cooldowns'))
assert 'evaluating_at' in cols('attempts')
user='qa-user'; now='2026-11-01T06:00:00.000Z'; expiry='2026-11-16T06:00:00.000Z'
conn.execute('INSERT INTO profiles(user_id,name,track,created_at) VALUES (?,?,?,?)',(user,'Tester',210,now))
conn.execute('UPDATE profiles SET phone=?,target=? WHERE user_id=?',('0000000000','8.0',user))
assert conn.execute('SELECT phone FROM profiles WHERE user_id=?',(user,)).fetchone()[0]=='0000000000'
conn.execute("INSERT INTO question_cooldowns(user_id,question_id,available_at) VALUES(?,?,?)",(user,'q1',expiry))
conn.execute("INSERT INTO question_cooldowns(user_id,question_id,available_at) VALUES(?,?,?) ON CONFLICT(user_id,question_id) DO UPDATE SET available_at=excluded.available_at",(user,'q1',expiry))
assert conn.execute('SELECT count(*) FROM question_cooldowns').fetchone()[0]==1
assert conn.execute('SELECT count(*) FROM question_cooldowns WHERE user_id=? AND available_at>?',(user,now)).fetchone()[0]==1
conn.execute('DELETE FROM question_cooldowns WHERE available_at<=?',(expiry,))
assert conn.execute('SELECT count(*) FROM question_cooldowns').fetchone()[0]==0
score=json.dumps({'passed':True,'practiceBand':6,'partScores':{'1':6,'2':6,'3':6},'durationSeconds':180,'issues':{'grammar':2,'vocabulary':1,'pronunciation':0,'fluency':0,'ideas':1,'spelling':0}})
conn.execute('INSERT INTO tests(id,user_id,milestone,kind,answers,completed_at) VALUES(?,?,?,?,?,?)',(str(uuid.uuid4()),user,7,'weekly',score,now))
assert json.loads(conn.execute('SELECT answers FROM tests WHERE user_id=?',(user,)).fetchone()[0])['partScores']['2']==6
conn.execute('INSERT INTO days(user_id,day,completed_at) VALUES (?,?,?)',(user,1,now))
assert conn.execute('SELECT day,completed_at FROM days WHERE user_id=?',(user,)).fetchone()==(1,now)
idx={r[1] for r in conn.execute("PRAGMA index_list('question_cooldowns')")}
assert 'question_cooldowns_expiration_idx' in idx
print('PASS: '+str(len(files))+' D1 migrations, all tables, profile, scoring, day history and cooldown SQL')

# The start-time table stores no audio, transcript or feedback, only minimum quota metadata.
assert {'id','user_id','category','kind','day','mode','started_at','expires_at','completed_at'}.issubset(cols('study_sessions'))
origin='2026-11-01T00:00:00.000Z'
cutoff6='2026-10-31T18:00:00.000Z'
cutoff24='2026-10-31T00:00:00.000Z'
session_sql="""INSERT INTO study_sessions(id,user_id,category,kind,day,mode,started_at,expires_at)
SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM study_sessions WHERE user_id=? AND category='practice' AND started_at>?)
AND (SELECT COUNT(*) FROM study_sessions WHERE user_id=? AND category='practice' AND started_at>?)<4"""
def admit(i,stamp,cutoff6,cutoff24):
 conn.execute(session_sql,(str(i),user,'practice','free',i,'practice',stamp,'2026-11-05T00:00:00.000Z',user,cutoff6,user,cutoff24))
 return conn.execute('SELECT changes()').fetchone()[0]
assert admit('a',origin,cutoff6,cutoff24)==1
assert admit('b','2026-11-01T00:00:00.000Z',cutoff6,cutoff24)==0, 'parallel same-slot insert must be rejected'
assert admit('c','2026-11-01T06:00:00.000Z',origin,cutoff24)==1
assert admit('d','2026-11-01T12:00:00.000Z','2026-11-01T06:00:00.000Z',cutoff24)==1
assert admit('e','2026-11-01T18:00:00.000Z','2026-11-01T12:00:00.000Z',cutoff24)==1
assert admit('f','2026-11-01T23:00:00.000Z','2026-11-01T17:00:00.000Z',cutoff24)==0, 'fifth practice within 24h rejected'
test_sql="""INSERT INTO study_sessions(id,user_id,category,kind,day,mode,started_at,expires_at)
SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM study_sessions WHERE user_id=? AND category='test' AND started_at>?)"""
params=lambda i,t,limit:(str(i),user,'test','weekly',7,'exam',t,'2026-11-15T00:00:00.000Z',user,limit)
conn.execute(test_sql,params('test1',origin,'2026-10-25T00:00:00.000Z'))
assert conn.execute('SELECT changes()').fetchone()[0]==1
conn.execute(test_sql,params('test2','2026-11-05T00:00:00.000Z','2026-10-29T00:00:00.000Z'))
assert conn.execute('SELECT changes()').fetchone()[0]==0
print('PASS: atomic D1 practice slot admission, fifth practice denial and seven-day test lock')
