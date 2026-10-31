"""Owner-private Site content updater. Credentials are accepted on hidden stdin only."""
import json,sys,urllib.request,urllib.error,urllib.parse,collections
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
if sys.stdin.isatty():
 import termios
 attr=termios.tcgetattr(sys.stdin);attr[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,attr)
print('Ready for private content update JSON on stdin (input is hidden).',flush=True)
p=json.loads(sys.stdin.readline());origin=p['origin'].rstrip('/');parsed=urllib.parse.urlparse(origin)
if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.chatgpt.site'):raise SystemExit('Use the exact HTTPS Site origin returned by Sites.')
opener=urllib.request.build_opener(NoRedirect)
def call(endpoint,data=None):
 headers={'OAI-Sites-Authorization':'Bearer '+p['token']}
 if data is not None:headers['Content-Type']='application/json'
 req=urllib.request.Request(origin+endpoint,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:
  with opener.open(req,timeout=25) as r:return json.load(r)
 except urllib.error.HTTPError as e:raise SystemExit(json.dumps({'ok':False,'status':e.code,'error':'Site access or content validation failed. No redirects followed.'}))
 except Exception as e:raise SystemExit(json.dumps({'ok':False,'error':type(e).__name__}))
if p.get('operation')=='write':
 result=call('/api/content-batch',{'questions':p['questions']});bank=call('/api/questions')['questions'];ids={q['id'] for q in bank};verified=all(q['id'] in ids for q in p['questions']);print(json.dumps({'ok':verified,'added':result['added'],'total':len(bank),'verified_ids':[q['id'] for q in p['questions'] if q['id'] in ids]}))
else:
 bank=call('/api/questions')['questions'];topic=p.get('topic');print(json.dumps({'ok':True,'total':len(bank),'topics':dict(collections.Counter(q['topic'] for q in bank)),'examples':[q['text'] for q in bank if not topic or q['topic']==topic][-30:]}))
