import { query } from '../db/postgres.js';
import { optionalString, requiredString } from '../utils/input.js';

function mapGroup(row) {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    memberCount: row.member_count === undefined ? undefined : Number(row.member_count),
    createdAt: row.created_at
  };
}

function mapMember(row) {
  return {
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    user: row.name === undefined
      ? undefined
      : {
          id: row.user_id,
          name: row.name,
          language: row.language,
          nationality: row.nationality
        }
  };
}

export async function listGroups({ userId } = {}) {
  const result = await query(
    `
      select
        g.*,
        count(gm_all.user_id) as member_count
      from public.groups g
      left join public.group_members gm_all on gm_all.group_id = g.id
      where (
        $1::uuid is null
        or g.owner_user_id = $1
        or exists (
          select 1
          from public.group_members gm
          where gm.group_id = g.id
            and gm.user_id = $1
        )
      )
      group by g.id
      order by g.created_at desc
    `,
    [userId || null]
  );

  return result.rows.map(mapGroup);
}

export async function getGroupById(groupId) {
  const result = await query(
    `
      select
        g.*,
        count(gm.user_id) as member_count
      from public.groups g
      left join public.group_members gm on gm.group_id = g.id
      where g.id = $1
      group by g.id
      limit 1
    `,
    [groupId]
  );

  return result.rows[0] ? mapGroup(result.rows[0]) : null;
}

export async function createGroup(input) {
  const name = requiredString(input.name, 'name');
  const ownerUserId = requiredString(input.ownerUserId, 'ownerUserId');

  const result = await query(
    `
      with inserted_group as (
        insert into public.groups (name, owner_user_id)
        values ($1, $2)
        returning *
      ),
      inserted_member as (
        insert into public.group_members (group_id, user_id, role)
        select id, owner_user_id, 'owner'
        from inserted_group
        on conflict (group_id, user_id)
        do update set role = excluded.role
        returning group_id
      )
      select
        inserted_group.*,
        1 as member_count
      from inserted_group
    `,
    [name, ownerUserId]
  );

  return mapGroup(result.rows[0]);
}

export async function updateGroup(groupId, input) {
  const name = optionalString(input.name);

  if (name === undefined) {
    return getGroupById(groupId);
  }

  if (!name) {
    const error = new Error('name is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `
      update public.groups
      set name = $1
      where id = $2
      returning *
    `,
    [name, groupId]
  );

  return result.rows[0] ? mapGroup(result.rows[0]) : null;
}

export async function listGroupMembers(groupId) {
  const result = await query(
    `
      select
        gm.group_id,
        gm.user_id,
        gm.role,
        u.name,
        u.language,
        u.nationality
      from public.group_members gm
      join public.users u on u.id = gm.user_id
      where gm.group_id = $1
      order by
        case gm.role when 'owner' then 0 else 1 end,
        u.name asc
    `,
    [groupId]
  );

  return result.rows.map(mapMember);
}

export async function upsertGroupMember(groupId, input) {
  const userId = requiredString(input.userId, 'userId');
  const role = optionalString(input.role) || 'member';

  const result = await query(
    `
      insert into public.group_members (group_id, user_id, role)
      values ($1, $2, $3)
      on conflict (group_id, user_id)
      do update set role = excluded.role
      returning *
    `,
    [groupId, userId, role]
  );

  return mapMember(result.rows[0]);
}

export async function removeGroupMember(groupId, userId) {
  const result = await query(
    `
      delete from public.group_members
      where group_id = $1
        and user_id = $2
      returning *
    `,
    [groupId, userId]
  );

  return result.rowCount > 0;
}
