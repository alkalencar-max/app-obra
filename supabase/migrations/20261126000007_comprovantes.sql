-- Comprovantes de pagamento: arquivo guardado no Storage e ligado ao lançamento.

alter table public.lancamentos add column if not exists comprovante_path text;

-- Bucket privado; cada arquivo fica em <empresa_id>/<obra_id>/<arquivo>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- Só quem é membro da empresa (primeira pasta do caminho) lê ou grava.
drop policy if exists "comprovantes_ler" on storage.objects;
create policy "comprovantes_ler" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1]::uuid in (select public.minhas_empresas()));

drop policy if exists "comprovantes_gravar" on storage.objects;
create policy "comprovantes_gravar" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1]::uuid in (select public.minhas_empresas()));

drop policy if exists "comprovantes_apagar" on storage.objects;
create policy "comprovantes_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1]::uuid in (select public.minhas_empresas()));
