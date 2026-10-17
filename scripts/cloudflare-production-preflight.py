#!/usr/bin/env python3
"""Read-only inventory of the existing Pages project. Never deploys or edits it."""
import hashlib,json,os,re,subprocess,urllib.request
from pathlib import Path

PROJECT='probation-study30-test'
PUBLIC='https://probation-study30-test.pages.dev/'

def main():
    account=os.environ['CLOUDFLARE_ACCOUNT_ID']
    token=os.environ['CLOUDFLARE_API_TOKEN']
    request=urllib.request.Request(
        'https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+PROJECT,
        headers={'Authorization':'Bearer '+token})
    with urllib.request.urlopen(request,timeout=30) as response:
        result=json.load(response)
    if not result.get('success'):
        raise RuntimeError('Pages project read failed; no changes were made')
    project=result['result']
    assert project['name']==PROJECT
    assert project['subdomain']==PROJECT+'.pages.dev'
    deployment=project.get('canonical_deployment') or {}
    trigger=(deployment.get('deployment_trigger') or {}).get('metadata') or {}
    canonical=deployment.get('url','')
    assert re.fullmatch(r'https://[a-zA-Z0-9-]+\.probation-study30-test\.pages\.dev',canonical), 'Unexpected production deployment URL'
    def download(url):
        return subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','25',url])
    live=download(PUBLIC)
    immutable=download(canonical+'/')
    assert live==immutable, 'Production alias no longer matches canonical deployment; repeat preflight'
    title=re.search(r'<title>(.*?)</title>',live.decode('utf-8'),re.S)
    # Explicit allowlist: do not export deployment configs, env vars or account identifiers.
    report={
        'project':PROJECT,'public_url':PUBLIC,'production_branch':project['production_branch'],
        'canonical_deployment':{
            'id':deployment['id'],'url':canonical,'environment':deployment.get('environment'),
            'created_on':deployment.get('created_on'),'commit_hash':trigger.get('commit_hash'),
            'branch':trigger.get('branch'),'latest_stage':deployment.get('latest_stage')},
        'current_title':title.group(1) if title else None,
        'current_index_sha256':hashlib.sha256(live).hexdigest(),
        'canonical_index_matches_public':True,
        'domains':project.get('domains',[]),'read_only':True}
    Path('cloudflare-production-preflight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('PREFLIGHT '+json.dumps(report,ensure_ascii=False))
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a',encoding='utf-8') as stream:
            stream.write('## Cloudflare production inventory (read only)\n\n')
            stream.write(f"- Target: {PUBLIC}\n- Production branch: `{report['production_branch']}`\n")
            stream.write(f"- Preserved deployment: `{deployment['id']}` / {canonical}\n")
            stream.write(f"- Current title: {report['current_title']}\n- Public/canonical bytes match. No deployment performed.\n")
if __name__=='__main__':
    main()
