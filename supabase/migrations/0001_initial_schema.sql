-- Advprev CRM, initial schema.
--
-- Every table of the domain lives here, and the access rule lives with it, in
-- the database, because the interface only reflects a rule it does not own. Row
-- level security is enabled on every table and no policy is permissive by
-- default: what is not granted is denied.
--
-- Identifiers are ULID text, the same identifier the application already mints,
-- so a record keeps its name across the move from file to database. UUID stays
-- reserved for an identifier that leaves the system, which does not exist yet.
--
-- Timestamps are timestamptz. Dates that the law counts, availability,
-- publication, start and due, are date, because a procedural deadline is a day
-- and never an instant.

-- ---------------------------------------------------------------------------
-- Enumerated domains. Each one mirrors a catalogue the application already
-- declares in TypeScript, so a value that the domain refuses cannot enter
-- through the database either.
-- ---------------------------------------------------------------------------

create type public.office_team as enum (
  'administration', 'intake', 'lawyer', 'finance'
);

create type public.case_sphere as enum (
  'labor', 'state-accident', 'state-civil', 'federal-social-security'
);

create type public.case_status as enum (
  'administrative', 'judicial', 'appeal', 'execution', 'closed'
);

create type public.document_state as enum (
  'uploading', 'uploaded', 'processing', 'processed', 'needs-review', 'failed'
);

create type public.deadline_regime as enum ('procedural', 'administrative');

-- Two states and nothing else. Automation never writes confirmed.
create type public.deadline_state as enum ('calculated', 'confirmed');

create type public.task_state as enum (
  'suggested', 'accepted', 'done', 'dismissed'
);

create type public.reminder_state as enum ('pending', 'done');

-- ---------------------------------------------------------------------------
-- Who is asking. The profile is the bridge between an authenticated identity
-- and the office team, and every policy below reads from it.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  team public.office_team not null default 'lawyer',
  oab_registration text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated member of the office. The team decides what the member may read, and the rule is enforced by the policies below and not by the interface.';

-- The helper the policies use. It is security definer so a policy can read the
-- team of the caller without the caller needing to read the whole table, and it
-- is stable so the planner calls it once per statement.
create or replace function public.current_team()
returns public.office_team
language sql
stable
security definer
set search_path = public
as $$
  select team from public.profiles where id = auth.uid()
$$;

create or replace function public.is_administration()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_team() = 'administration', false)
$$;

-- ---------------------------------------------------------------------------
-- Client and case. A client with three pleaded benefits has three cases, and
-- they never mix: the case carries the client, never the other way round.
-- ---------------------------------------------------------------------------

create table public.clients (
  id text primary key,
  full_name text not null,
  cpf text not null,
  rg text not null,
  birth_date date not null,
  mother_name text,
  phone text not null,
  email text not null,
  address text not null,
  city_state text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create unique index clients_cpf_key on public.clients (cpf);

create table public.cases (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  sphere public.case_sphere not null,
  case_type text not null,
  opposing_party text not null,
  status public.case_status not null,
  responsible_lawyer text not null,
  -- The identity behind the name. The name is what the screen shows; this is
  -- what the policy reads, because a lawyer sees exclusively his own cases.
  responsible_lawyer_id uuid references public.profiles (id),
  reference text,
  fact_summary text,
  -- Validated by its own check digits in the application before it arrives.
  lawsuit_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_client_id_idx on public.cases (client_id);
create index cases_lawsuit_number_idx on public.cases (lawsuit_number);
create index cases_responsible_lawyer_id_idx on public.cases (responsible_lawyer_id);

create table public.client_notices (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  case_id text not null references public.cases (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  event_date date,
  event_time text,
  place text,
  created_at timestamptz not null default now(),
  origin jsonb not null
);

create index client_notices_client_id_idx on public.client_notices (client_id);

-- ---------------------------------------------------------------------------
-- Documents. The bytes live in storage; this table is the record of them, and
-- the reading of each page lives beside it with the confidence it was measured
-- with, never without.
-- ---------------------------------------------------------------------------

create table public.case_documents (
  id text primary key,
  case_id text not null references public.cases (id) on delete cascade,
  file_name text not null,
  stored_name text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  state public.document_state not null,
  state_note text,
  -- SHA-256 of the bytes, which is what keeps one document from being read
  -- twice and makes two identical uploads the same document.
  fingerprint text,
  uploaded_at timestamptz not null default now(),
  uploaded_by text not null,
  extracted_at timestamptz,
  mean_confidence numeric(5,2),
  page_count integer check (page_count >= 0),
  ocr_pages integer check (ocr_pages >= 0),
  -- The rest of what one reading measured, so the record of an extraction is
  -- complete beside the document instead of living in a file next to it.
  text_layer_pages integer check (text_layer_pages >= 0),
  extraction_engine text,
  extraction_language text,
  extraction_duration_ms integer,
  extraction_note text
);

create index case_documents_case_id_idx on public.case_documents (case_id);
create unique index case_documents_fingerprint_key
  on public.case_documents (fingerprint) where fingerprint is not null;

create table public.document_pages (
  document_id text not null references public.case_documents (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  text text not null,
  -- Where the text came from. A text layer is the text the document carries; an
  -- optical read is a measurement, and the two are never confused.
  source text not null,
  -- Measured, never assumed. A page below the office threshold stays pending
  -- human validation and is never used in a calculation, a filing or a decision.
  confidence numeric(5,2) not null,
  words integer not null default 0,
  attempt text not null default '',
  primary key (document_id, page_number)
);

-- Every read and every download of a document is an event, with author, file
-- and moment, and the trail is not editable and not deletable by the
-- application.
-- The trail of who touched a document. It carries no foreign key on purpose:
-- deleting a document must never erase the evidence of who read it, and an
-- audit row that disappears with its subject is not an audit row.
create table public.document_access_events (
  id text primary key,
  at timestamptz not null default now(),
  actor text not null,
  actor_role text not null,
  action text not null,
  document_id text not null,
  file_name text not null,
  client_id text not null,
  case_id text not null,
  -- The page and the measured confidence of the passage the entity read, when
  -- the access was a reading of one page and not of the whole document.
  page integer,
  confidence numeric,
  origin text not null,
  project_version text not null
);

create index document_access_events_document_id_idx
  on public.document_access_events (document_id);
create index document_access_events_at_idx
  on public.document_access_events (at desc);

-- ---------------------------------------------------------------------------
-- The deadline, which is the record that most protects the office. The whole
-- chain is stored, with the days that were not counted and the legal source of
-- every step, because the screen shows the chain and not only the result.
-- ---------------------------------------------------------------------------

create table public.case_deadlines (
  id text primary key,
  case_id text not null references public.cases (id) on delete cascade,
  label text not null,
  regime public.deadline_regime not null,
  available_on date not null,
  published_on date not null,
  starts_on date not null,
  due_on date not null,
  days integer not null check (days > 0),
  counted_in_business_days boolean not null default true,
  court text,
  calendar_reviewed boolean not null default false,
  warnings text[] not null default '{}',
  skipped jsonb not null default '[]',
  legal_sources text[] not null default '{}',
  state public.deadline_state not null default 'calculated',
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  origin jsonb not null,
  -- A confirmed deadline names who confirmed it and when. The database refuses
  -- a confirmation without an author, so no automation can slip one through.
  constraint case_deadlines_confirmation_is_signed check (
    state = 'calculated'
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create index case_deadlines_case_id_idx on public.case_deadlines (case_id);
create index case_deadlines_due_on_idx on public.case_deadlines (due_on);

create table public.case_tasks (
  id text primary key,
  case_id text not null references public.cases (id) on delete cascade,
  title text not null,
  detail text,
  state public.task_state not null default 'suggested',
  responsible text not null,
  internal_due_on date,
  deadline_id text references public.case_deadlines (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  origin jsonb not null
);

create index case_tasks_case_id_idx on public.case_tasks (case_id);

create table public.case_events (
  id text primary key,
  case_id text not null references public.cases (id) on delete cascade,
  kind text not null,
  title text not null,
  date date not null,
  time text,
  place text,
  created_at timestamptz not null default now(),
  origin jsonb not null
);

create index case_events_case_id_idx on public.case_events (case_id);
create index case_events_date_idx on public.case_events (date);

create table public.case_reminders (
  id text primary key,
  case_id text not null references public.cases (id) on delete cascade,
  for_lawyer text not null,
  remind_on date not null,
  message text not null,
  event_id text not null references public.case_events (id) on delete cascade,
  state public.reminder_state not null default 'pending',
  created_at timestamptz not null default now(),
  done_by text,
  done_at timestamptz,
  origin jsonb not null
);

create index case_reminders_case_id_idx on public.case_reminders (case_id);

-- ---------------------------------------------------------------------------
-- Capture. The official act is stored exactly as it arrived, with its source
-- and its capture moment, and it is never discarded when it matches no case.
-- ---------------------------------------------------------------------------

create table public.communications (
  id text primary key,
  source text not null,
  captured_at timestamptz not null default now(),
  -- The registration of the office that brought this act back.
  monitored_oab text not null,
  external_id text,
  certificate_code text,
  certificate_url text,
  lawsuit_number text,
  lawsuit_number_label text,
  available_on date not null,
  tribunal text,
  court_name text,
  case_class text,
  document_type text,
  medium text,
  -- The official text, byte for byte as the service delivered it.
  official_text text not null,
  recipients jsonb not null default '[]'::jsonb,
  lawyers jsonb not null default '[]'::jsonb,
  -- The payload exactly as it arrived, so a field the office failed to read
  -- today is readable tomorrow without asking the court again.
  raw jsonb,
  -- What the deterministic rules read from the act, with the residue they
  -- could not decide. Never a model's opinion.
  extraction jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  client_id text references public.clients (id) on delete set null,
  case_id text references public.cases (id) on delete set null,
  -- By process number the link is automatic, by a person it is never automatic.
  link_method text,
  linked_at timestamptz,
  linked_by text,
  -- When the office turned this act into deadline, notice, reminder and task.
  applied_at timestamptz,
  applied_note text,
  fingerprint text not null
);

create unique index communications_fingerprint_key on public.communications (fingerprint);
create index communications_lawsuit_number_idx on public.communications (lawsuit_number);
create index communications_case_id_idx on public.communications (case_id);
create index communications_available_on_idx on public.communications (available_on desc);

create table public.capture_runs (
  id text primary key,
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  ok boolean not null,
  -- Which attempt of this execution succeeded or gave up, counting from one.
  attempts integer not null default 1,
  -- What the office asked for, so a failure can be reproduced by hand.
  query text not null,
  status integer,
  reason text,
  found integer not null default 0,
  stored integer not null default 0,
  duplicates integer not null default 0,
  linked integer not null default 0,
  suggested integer not null default 0,
  unlinked integer not null default 0,
  project_version text not null
);

create index capture_runs_started_at_idx on public.capture_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- The audit trail. Immutable by construction: no update policy and no delete
-- policy exists for it anywhere in this file, so the application cannot alter
-- or erase what it wrote, and only the administration reads it.
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id text primary key,
  actor text not null,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  origin text not null default 'application',
  at timestamptz not null default now()
);

create index audit_events_at_idx on public.audit_events (at desc);
create index audit_events_entity_idx on public.audit_events (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Row level security. Enabled on every table, with the office matrix written
-- as policy: administration sees everything; intake works the records and never
-- the money; a lawyer sees exclusively his own cases; finance sees the minimal
-- case registry and never a document, because health data is segregated.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.client_notices enable row level security;
alter table public.case_documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_access_events enable row level security;
alter table public.case_deadlines enable row level security;
alter table public.case_tasks enable row level security;
alter table public.case_events enable row level security;
alter table public.case_reminders enable row level security;
alter table public.communications enable row level security;
alter table public.capture_runs enable row level security;
alter table public.audit_events enable row level security;

-- A member reads his own profile; the administration reads and writes all.
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_administration());

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_administration())
  with check (id = auth.uid() or public.is_administration());

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_administration());

-- The predicate that decides whether the caller may see a case at all.
create or replace function public.can_read_case(target_case_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cases c
    where c.id = target_case_id
      and (
        public.current_team() in ('administration', 'intake', 'finance')
        or (public.current_team() = 'lawyer' and c.responsible_lawyer_id = auth.uid())
      )
  )
$$;

create policy cases_read on public.cases
  for select to authenticated
  using (
    public.current_team() in ('administration', 'intake', 'finance')
    or (public.current_team() = 'lawyer' and responsible_lawyer_id = auth.uid())
  );

create policy cases_write on public.cases
  for all to authenticated
  using (
    public.current_team() in ('administration', 'intake')
    or (public.current_team() = 'lawyer' and responsible_lawyer_id = auth.uid())
  )
  with check (
    public.current_team() in ('administration', 'intake')
    or (public.current_team() = 'lawyer' and responsible_lawyer_id = auth.uid())
  );

-- The client registry: everyone who works a case needs it, finance needs the
-- minimum of it, and the minimum is enforced by the column grant below.
create policy clients_read on public.clients
  for select to authenticated
  using (public.current_team() in ('administration', 'intake', 'lawyer'));

create policy clients_write on public.clients
  for all to authenticated
  using (public.current_team() in ('administration', 'intake', 'lawyer'))
  with check (public.current_team() in ('administration', 'intake', 'lawyer'));

create policy client_notices_read on public.client_notices
  for select to authenticated using (public.can_read_case(case_id));
create policy client_notices_write on public.client_notices
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

-- Documents, and the finance team is absent from every one of these policies on
-- purpose: it never reads a health document, a report, an examination or the
-- text extracted from them.
create policy case_documents_read on public.case_documents
  for select to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance');
create policy case_documents_write on public.case_documents
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

create policy document_pages_read on public.document_pages
  for select to authenticated
  using (
    public.current_team() <> 'finance'
    and exists (
      select 1 from public.case_documents d
      where d.id = document_id and public.can_read_case(d.case_id)
    )
  );
create policy document_pages_write on public.document_pages
  for all to authenticated
  using (
    public.current_team() <> 'finance'
    and exists (
      select 1 from public.case_documents d
      where d.id = document_id and public.can_read_case(d.case_id)
    )
  )
  with check (
    public.current_team() <> 'finance'
    and exists (
      select 1 from public.case_documents d
      where d.id = document_id and public.can_read_case(d.case_id)
    )
  );

-- Access events are written by whoever reads a document and read only by the
-- administration. There is no update and no delete policy: the trail is append
-- only, which is what makes it a trail.
create policy document_access_events_insert on public.document_access_events
  for insert to authenticated with check (public.can_read_case(case_id));
create policy document_access_events_read on public.document_access_events
  for select to authenticated using (public.is_administration());

create policy case_deadlines_read on public.case_deadlines
  for select to authenticated using (public.can_read_case(case_id));
create policy case_deadlines_write on public.case_deadlines
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

create policy case_tasks_read on public.case_tasks
  for select to authenticated using (public.can_read_case(case_id));
create policy case_tasks_write on public.case_tasks
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

create policy case_events_read on public.case_events
  for select to authenticated using (public.can_read_case(case_id));
create policy case_events_write on public.case_events
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

create policy case_reminders_read on public.case_reminders
  for select to authenticated using (public.can_read_case(case_id));
create policy case_reminders_write on public.case_reminders
  for all to authenticated
  using (public.can_read_case(case_id) and public.current_team() <> 'finance')
  with check (public.can_read_case(case_id) and public.current_team() <> 'finance');

-- A captured act that matched no case is visible to whoever works the queue,
-- which is the administration, the intake and the lawyers, never finance.
create policy communications_read on public.communications
  for select to authenticated
  using (
    public.current_team() in ('administration', 'intake')
    or (public.current_team() = 'lawyer'
        and (case_id is null or public.can_read_case(case_id)))
  );
create policy communications_write on public.communications
  for all to authenticated
  using (public.current_team() in ('administration', 'intake', 'lawyer'))
  with check (public.current_team() in ('administration', 'intake', 'lawyer'));

create policy capture_runs_read on public.capture_runs
  for select to authenticated
  using (public.current_team() in ('administration', 'intake', 'lawyer'));
create policy capture_runs_write on public.capture_runs
  for all to authenticated
  using (public.is_administration())
  with check (public.is_administration());

create policy audit_events_read on public.audit_events
  for select to authenticated using (public.is_administration());
create policy audit_events_insert on public.audit_events
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Grants. The project was created with automatic exposure of new tables turned
-- off, which is the recommended posture, so every privilege below is granted on
-- purpose and nothing is open because nobody looked.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.clients, public.cases, public.client_notices,
  public.case_documents, public.document_pages, public.case_deadlines,
  public.case_tasks, public.case_events, public.case_reminders,
  public.communications, public.capture_runs
  to authenticated;

grant select, insert on public.document_access_events to authenticated;
grant select, insert on public.audit_events to authenticated;

-- The service role bypasses row level security but not table privileges, so the
-- few server side operations that legitimately act as the office itself, the
-- first account of the administration and serving the bytes of a stored object,
-- need them stated. Measured on 2026-09-01: without this, creating the
-- administrator answered permission denied for table profiles.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on public.finance_client_registry to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- The finance team reads the minimal case registry and nothing else of a
-- client: no address, no telephone, no electronic address, no mother's name,
-- no notes. Column privileges are granted per database role and every team
-- shares the authenticated role, so the matrix cannot be written as a column
-- grant. It is written as a view that carries only the entitled columns and
-- refuses anyone who is not finance or administration, while the policy above
-- keeps finance out of the table itself.
create view public.finance_client_registry
with (security_barrier = true)
as
  select c.id, c.full_name, c.cpf, c.city_state, c.created_at, c.updated_at
  from public.clients c
  where public.current_team() in ('finance', 'administration');

comment on view public.finance_client_registry is
  'The minimal client registry the finance team may read. Health data, contact data and notes are absent by construction, not by convention.';

grant select on public.finance_client_registry to authenticated;

-- ---------------------------------------------------------------------------
-- Storage. Two buckets, both private: the documents of the office and the photo
-- of an account. Nothing here is public, and every object is reached through
-- the application, never by a link that outlives a session.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('case-documents', 'case-documents', false, 52428800),
  ('avatars', 'avatars', false, 2000000)
on conflict (id) do nothing;

-- The bytes of a document belong to the case the document belongs to, and the
-- first folder of the object name is the identifier of that case. Reaching the
-- bytes therefore requires the same right as reaching the row: measured on
-- 2026-09-01, a policy that only excluded finance let one lawyer download the
-- health document of another lawyer's client through the storage API.
create policy "case documents are read by whoever may read the case"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'case-documents'
    and public.current_team() <> 'finance'
    and public.can_read_case((storage.foldername(name))[1])
  );

create policy "case documents are written by whoever may read the case"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and public.current_team() <> 'finance'
    and public.can_read_case((storage.foldername(name))[1])
  );

-- A photo is personal data of one account. Measured on 2026-09-01, a policy
-- that only named the bucket let any account download any other account's photo.
create policy "an account reads its own photo"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_administration()
    )
  );

create policy "an account writes its own photo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "an account replaces its own photo"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Nobody promotes himself. Row level security decides whether a row may be
-- written, never which column of it, so the team of an account is guarded by a
-- trigger instead: measured on 2026-09-01, a lawyer updating his own profile
-- could set his team to administration and inherit the whole office, including
-- the audit trail.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team is distinct from old.team and not public.is_administration() then
    raise exception 'O time de uma conta e alterado apenas pela Administracao.'
      using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'O identificador de uma conta nao muda.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_team on public.profiles;
create trigger guard_profile_team
  before update on public.profiles
  for each row execute function public.guard_profile_team();

-- ---------------------------------------------------------------------------
-- The profile of a new account is created with the account, so an authenticated
-- identity always has a team and the policies always have something to read.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, team)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce((new.raw_user_meta_data ->> 'team')::public.office_team, 'lawyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
