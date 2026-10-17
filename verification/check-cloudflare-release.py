"""Release guard tests with a fake transport: never calls Cloudflare."""
import copy,hashlib,importlib.util,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('release',Path(__file__).parents[1]/'scripts/cloudflare-release-control.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sha='a'*40
old={'name':m.PROJECT,'subdomain':m.PROJECT+'.pages.dev','production_branch':'main','source':None,'canonical_deployment':{'id':m.ORIGINAL_ID,'url':'https://eb1113aa.probation-study30-test.pages.dev','environment':'production'}}
class Fake:
    def __init__(self,project=None):self.data=copy.deepcopy(project or old);self.calls=[];self.body=b'original';self.manifest=None
    def project(self):return copy.deepcopy(self.data)
    def read(self,url):return json.dumps(self.manifest).encode() if url.endswith('mirror-manifest.json') else self.body
    def rollback(self,identifier):self.calls.append(identifier);self.data=copy.deepcopy(old);self.body=b'original'
def rejected(fn):
    try:fn()
    except (AssertionError,KeyError,ValueError):return
    raise AssertionError('Unsafe release action was accepted')
original=m.ORIGINAL_INDEX;m.ORIGINAL_INDEX=hashlib.sha256(b'original').hexdigest()
f=Fake();state=m.prepare(f,sha);assert f.calls==[] and state['previous_deployment_id']==m.ORIGINAL_ID
for field,value in [('name','another-project'),('production_branch','another-branch'),('subdomain','other.pages.dev')]:
    bad=copy.deepcopy(old);bad[field]=value;rejected(lambda bad=bad:m.prepare(Fake(bad),sha))
bad=copy.deepcopy(old);bad['source']={'config':{'production_deployments_enabled':True}};rejected(lambda:m.prepare(Fake(bad),sha))
f=Fake();f.body=b'changed';rejected(lambda:m.prepare(f,sha))
f=Fake();f.data['canonical_deployment'].update(id='11111111-1111-1111-1111-111111111111',deployment_trigger={'metadata':{'commit_hash':'b'*40}});rejected(lambda:m.restore(f,state,sha));assert f.calls==[]
f=Fake();assert m.restore(f,state,sha)['restored'] is False and f.calls==[]
f.data['canonical_deployment'].update(id='11111111-1111-1111-1111-111111111111',deployment_trigger={'metadata':{'commit_hash':sha}});assert m.restore(f,state,sha)['restored'] is True;assert f.calls==[m.ORIGINAL_ID]
f=Fake();f.data['canonical_deployment'].update(id='11111111-1111-1111-1111-111111111111',deployment_trigger={'metadata':{'commit_hash':'b'*40}});f.manifest={'repository':m.REPOSITORY,'source_commit':'b'*40,'file_sha256':{'index.html':hashlib.sha256(f.body).hexdigest()}};assert m.prepare(f,sha)['previous_deployment_id']!=''
f.manifest['repository']='another/repository';rejected(lambda:m.prepare(f,sha))
m.ORIGINAL_INDEX=original
print('PASS: target/branch/provenance/race guards and rollback ownership; no live Cloudflare writes')
