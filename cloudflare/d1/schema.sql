create table if not exists app_records (
  resource text not null,
  id text not null,
  payload text not null,
  primary key (resource, id)
);

create index if not exists app_records_resource_idx
on app_records (resource);
