-- Run once in a NEW Supabase project. No personal records or credentials here.
-- Private tables are not exposed through PostgREST. Only authenticated RPCs.
begin;
create schema if not exists psd_private;
revoke all on schema psd_private from public, anon, authenticated;
create table if not exists psd_private.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 sequence bigint not null default 0 check (sequence between 0 and 9007199254740990)
);
create table if not exists psd_private.records (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null, revision bigint not null, value jsonb not null, deleted boolean not null,
 primary key(user_id,id)
);
create table if not exists psd_private.events (
 user_id uuid not null references auth.users(id) on delete cascade,
 sequence bigint not null, id text not null, revision bigint not null,
 value jsonb not null, deleted boolean not null, primary key(user_id,sequence)
);
create table if not exists psd_private.operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, request jsonb not null, response jsonb not null,
 primary key(user_id,op_id)
);
alter table psd_private.accounts enable row level security;
alter table psd_private.records enable row level security;
alter table psd_private.events enable row level security;
alter table psd_private.operations enable row level security;
-- No table grants/policies: clients can only invoke the checked functions below.
create or replace function public.psd_sync_push(p_operation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 who uuid := auth.uid();
 op uuid;
 item text;
 base bigint;
 current_record psd_private.records%rowtype;
 cached psd_private.operations%rowtype;
 next_sequence bigint;
 answer jsonb;
begin
 if who is null then raise exception 'authentication required' using errcode='42501'; end if;
 if jsonb_typeof(p_operation) is distinct from 'object'
    or octet_length(p_operation::text)>1100000
    or jsonb_typeof(p_operation->'id') is distinct from 'string'
    or (p_operation->>'id') !~ '^[a-zA-Z0-9_:/.-]{1,240}$'
    or (p_operation->>'id') in ('__proto__','constructor','prototype','toString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','toLocaleString')
    or jsonb_typeof(p_operation->'opId') is distinct from 'string'
    or (p_operation->>'opId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or jsonb_typeof(p_operation->'baseRevision') is distinct from 'number'
    or (p_operation->>'baseRevision') !~ '^[0-9]{1,16}$'
    or jsonb_typeof(p_operation->'deleted') is distinct from 'boolean'
    or not (p_operation ? 'value')
 then raise exception 'invalid operation'; end if;
 op:=(p_operation->>'opId')::uuid; item:=p_operation->>'id'; base:=(p_operation->>'baseRevision')::bigint;
 if base>9007199254740990 then raise exception 'revision out of range'; end if;
 insert into psd_private.accounts(user_id) values(who) on conflict do nothing;
 -- Per-user serialization prevents commits arriving behind an already-read cursor.
 perform 1 from psd_private.accounts where user_id=who for update;
 select * into cached from psd_private.operations where user_id=who and op_id=op;
 if found then
   if cached.request<>p_operation then raise exception 'operation ID reused with different content'; end if;
   return cached.response;
 end if;
 select * into current_record from psd_private.records where user_id=who and id=item;
 if current_record.revision is null and base<>0 then raise exception 'unknown base revision'; end if;
 if coalesce(current_record.revision,0)<>base then
   answer:=jsonb_build_object('status','conflict','record',jsonb_build_object('revision',current_record.revision,'value',current_record.value,'deleted',current_record.deleted));
 else
   update psd_private.accounts set sequence=sequence+1 where user_id=who returning sequence into next_sequence;
   insert into psd_private.records(user_id,id,revision,value,deleted)
   values(who,item,base+1,p_operation->'value',(p_operation->>'deleted')::boolean)
   on conflict(user_id,id) do update set revision=excluded.revision,value=excluded.value,deleted=excluded.deleted;
   insert into psd_private.events(user_id,sequence,id,revision,value,deleted)
   values(who,next_sequence,item,base+1,p_operation->'value',(p_operation->>'deleted')::boolean);
   answer:=jsonb_build_object('status','ok','record',jsonb_build_object('revision',base+1,'value',p_operation->'value','deleted',(p_operation->>'deleted')::boolean));
 end if;
 insert into psd_private.operations(user_id,op_id,request,response) values(who,op,p_operation,answer);
 return answer;
end $$;
create or replace function public.psd_sync_pull(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare who uuid:=auth.uid(); items jsonb; has_more boolean; last_cursor bigint;
begin
 if who is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_after is null or p_after<0 or p_after>9007199254740990 then raise exception 'invalid cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.sequence),'[]'::jsonb) into items
 from (select sequence,id,revision,value,deleted from (select e.*,sum(octet_length(e.value::text)+500) over(order by e.sequence) as bytes from (select * from psd_private.events where user_id=who and sequence>p_after order by sequence limit 200) e) bounded where bytes<=4000000 order by sequence) x;
 last_cursor:=coalesce((items->-1->>'sequence')::bigint,p_after);
 select exists(select 1 from psd_private.events where user_id=who and sequence>last_cursor) into has_more;
 return jsonb_build_object('changes',items,'more',has_more);
end $$;
revoke all on function public.psd_sync_push(jsonb) from public, anon;
revoke all on function public.psd_sync_pull(bigint) from public, anon;
grant execute on function public.psd_sync_push(jsonb) to authenticated;
grant execute on function public.psd_sync_pull(bigint) to authenticated;
commit;
