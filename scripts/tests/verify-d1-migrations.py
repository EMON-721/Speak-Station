#!/usr/bin/env python3
"""Verify all historical D1 SQLite migrations on a disposable in-memory database."""
import pathlib, sqlite3, json, datetime, uuid
conn=sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys=ON')
files=sorted(pathlib.Path('drizzle').glob('*.sql'))
assert len(files)>=6, 'Migrations missing'
for path in files:
    statements=path.read_text().replace('--> statement-breakpoint','').strip()
    conn.executescript(statements)
tables={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required={'attempts','audit','days','question_overrides','profiles','saved','tests','usage','settings','messages','user_access','question_cooldowns'}
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
