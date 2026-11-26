-- Permissões do usuário logado nas tabelas e visões. O RLS continua decidindo quais linhas ele vê;
-- sem este grant o Postgres nega o acesso antes do RLS e o app fica preso no "Bem-vindo".
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
