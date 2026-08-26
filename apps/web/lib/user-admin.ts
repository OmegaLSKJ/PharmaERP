import 'server-only'
import { adminClient } from './auth'

export type ManagedUserRole = 'admin' | 'manager' | 'operator'
export type ManagedUser = {
  id: string
  email: string
  name: string
  role: ManagedUserRole
  status: 'active' | 'invited' | 'disabled'
  createdAt: string
  lastSignInAt: string | null
}

function roleOf(value: unknown): ManagedUserRole {
  return value === 'admin' || value === 'manager' ? value : 'operator'
}

function view(user: any): ManagedUser {
  const disabled = user.banned_until && new Date(user.banned_until).getTime() > Date.now()
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'ERP user',
    role: roleOf(user.app_metadata?.role),
    status: disabled ? 'disabled' : user.last_sign_in_at ? 'active' : 'invited',
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  }
}

export async function listManagedUsers() {
  const client = adminClient()
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error('Unable to load users.')
  return data.users.map(view).sort((a: any, b: any) => a.email.localeCompare(b.email))
}

export async function inviteManagedUser(input: { email: string; name: string; role: ManagedUserRole; redirectTo: string }) {
  const client = adminClient()
  const { data, error } = await client.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
    data: { name: input.name },
  })
  if (error || !data.user) throw new Error(error?.message ?? 'Unable to invite user.')
  const { data: updated, error: roleError } = await client.auth.admin.updateUserById(data.user.id, {
    app_metadata: { ...data.user.app_metadata, role: input.role },
  })
  if (roleError || !updated.user) {
    await client.auth.admin.deleteUser(data.user.id)
    throw new Error(roleError?.message ?? 'Unable to assign the user role.')
  }
  return view(updated.user)
}

export async function updateManagedUser(id: string, input: { role?: ManagedUserRole; active?: boolean }, actorId: string) {
  if (id === actorId && input.active === false) throw new Error('You cannot disable your own account.')
  const client = adminClient()
  const { data: currentData, error: currentError } = await client.auth.admin.getUserById(id)
  if (currentError || !currentData.user) throw new Error('User was not found.')
  if (currentData.user.app_metadata?.role === 'admin' && (input.role && input.role !== 'admin' || input.active === false)) {
    const users = await listManagedUsers()
    if (users.filter((user: any) => user.role === 'admin' && user.status !== 'disabled').length <= 1) throw new Error('At least one active administrator is required.')
  }
  const attributes: any = {}
  if (input.role) attributes.app_metadata = { ...currentData.user.app_metadata, role: input.role }
  if (typeof input.active === 'boolean') attributes.ban_duration = input.active ? 'none' : '876000h'
  const { data, error } = await client.auth.admin.updateUserById(id, attributes)
  if (error || !data.user) throw new Error(error?.message ?? 'Unable to update user.')
  return view(data.user)
}

export async function removeManagedUser(id: string, actorId: string) {
  if (id === actorId) throw new Error('You cannot remove your own account.')
  const client = adminClient()
  const { data: currentData, error: currentError } = await client.auth.admin.getUserById(id)
  if (currentError || !currentData.user) throw new Error('User was not found.')
  if (currentData.user.app_metadata?.role === 'admin') {
    const users = await listManagedUsers()
    if (users.filter((user: any) => user.role === 'admin' && user.status !== 'disabled').length <= 1) throw new Error('The last active administrator cannot be removed.')
  }
  const { error } = await client.auth.admin.deleteUser(id, false)
  if (error) throw new Error(error.message)
}
