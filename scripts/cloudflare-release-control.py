#!/usr/bin/env python3
"""Guard the one approved Pages project and restore only this run's failed release."""
import argparse,hashlib,json,os,re,subprocess,urllib.request
from pathlib import Path

PROJECT='probation-study30-test'
PUBLIC='https://probation-study30-test.pages.dev/'
REPOSITORY='LeoKYChen/probation-study-desk'
ORIGINAL_ID='eb1113aa-5904-458f-ac97-1e2cb0cd9f67'
ORIGINAL_INDEX='cc34a71a4ba8d9b13181f78d961007c3991f2912faa612a7fa7c69910ad0c133'

class Pages:
    def __init__(self):
        self.base='https://api.cloudflare.com/client/v4/accounts/'+os.environ['CLOUDFLARE_ACCOUNT_ID']+'/pages/projects/'+PROJECT
        self.token=os.environ['CLOUDFLARE_API_TOKEN']
    def api(self,path='',method='GET'):
        request=urllib.request.Request(self.base+path,method=method,headers={'Authorization':'Bearer '+self.token})
        with urllib.request.urlopen(request,timeout=30) as response:data=json.load(response)
        if not data.get('success'):raise RuntimeError('Pages API request failed; no response configuration exported')
        return data['result']
    def project(self):return self.api()
    def read(self,url):return subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','25',url])
    def rollback(self,deployment_id):return self.api('/deployments/'+deployment_id+'/rollback','POST')

def checked_project(project):
    assert project['name']==PROJECT and project['subdomain']==PROJECT+'.pages.dev','Wrong project'
    assert project['production_branch']=='main','Production branch changed; inspect before releasing'
    source=project.get('source') or {}
    assert not (source.get('config') or {}).get('production_deployments_enabled',False), 'Native Git deployment must not race the explicit release workflow'
    deployment=project['canonical_deployment']
    assert deployment['environment']=='production','Canonical deployment must be production'
    assert re.fullmatch(r'[0-9a-f-]{36}',deployment['id']),'Invalid deployment ID'
    assert re.fullmatch(r'https://[a-zA-Z0-9-]+\.probation-study30-test\.pages\.dev',deployment['url']),'Invalid canonical URL'
    return deployment

def prepare(client,expected_commit):
    assert re.fullmatch(r'[0-9a-f]{40}',expected_commit),'Invalid source SHA'
    deployment=checked_project(client.project())
    live=client.read(PUBLIC)
    assert live==client.read(deployment['url']+'/'),'Production moved during inventory'
    if deployment['id']==ORIGINAL_ID:
        assert hashlib.sha256(live).hexdigest()==ORIGINAL_INDEX,'Original production bytes changed'
    else:
        manifest=json.loads(client.read(PUBLIC+'mirror-manifest.json'))
        trigger=(deployment.get('deployment_trigger') or {}).get('metadata') or {}
        assert manifest['repository']==REPOSITORY and re.fullmatch(r'[0-9a-f]{40}',manifest['source_commit']),'Unmanaged current deployment'
        assert trigger.get('commit_hash')==manifest['source_commit'],'Current deployment provenance differs'
        assert hashlib.sha256(live).hexdigest()==manifest['file_sha256']['index.html'],'Current homepage is not its declared version'
    return {'schema_version':1,'project':PROJECT,'public_url':PUBLIC,'production_branch':'main',
            'previous_deployment_id':deployment['id'],'previous_deployment_url':deployment['url'],
            'previous_index_sha256':hashlib.sha256(live).hexdigest(),'release_commit':expected_commit}

def restore(client,state,expected_commit):
    assert state['project']==PROJECT and state['public_url']==PUBLIC and state['release_commit']==expected_commit,'Wrong recovery target'
    previous=state['previous_deployment_id']
    assert re.fullmatch(r'[0-9a-f-]{36}',previous),'Invalid recovery ID'
    current=checked_project(client.project())
    if current['id']==previous:return {'restored':False,'reason':'previous production is still current'}
    trigger=(current.get('deployment_trigger') or {}).get('metadata') or {}
    assert trigger.get('commit_hash')==expected_commit,'Refusing to undo a deployment from another run'
    client.rollback(previous)
    restored=checked_project(client.project())
    assert restored['id']==previous,'Rollback identity not confirmed'
    assert hashlib.sha256(client.read(PUBLIC)).hexdigest()==state['previous_index_sha256'],'Rollback homepage not confirmed'
    return {'restored':True,'deployment_id':previous}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('operation',choices=['prepare','recheck','rollback']);parser.add_argument('--commit',required=True);parser.add_argument('--state',default='cloudflare-production-before-release.json');args=parser.parse_args()
    client=Pages();path=Path(args.state)
    if args.operation=='prepare':
        state=prepare(client,args.commit);path.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');print('PREPARED '+json.dumps(state))
    elif args.operation=='recheck':
        state=json.loads(path.read_text());assert state['release_commit']==args.commit
        current=checked_project(client.project());assert current['id']==state['previous_deployment_id'],'Production moved before publish'
        print('PASS: production still matches the captured recovery target')
    else:print('RECOVERY '+json.dumps(restore(client,json.loads(path.read_text()),args.commit)))
if __name__=='__main__':main()
