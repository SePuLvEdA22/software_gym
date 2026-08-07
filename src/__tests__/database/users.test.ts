import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initDatabase, closeDatabase } from '../../main/database/index'
import {
  authenticateUser,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getUserById,
  getUserByUsername,
  verifyUserPassword,
  clearMustChangePassword,
} from '../../main/database/users'

describe('Users Database', () => {
  beforeAll(async () => {
    await initDatabase()
  })

  afterAll(() => {
    closeDatabase()
  })

  it('should authenticate admin user with default credentials', () => {
    const result = authenticateUser('admin', 'admin123')
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user!.username).toBe('admin')
    expect(result.user!.role).toBe('admin')
  })

  it('should reject invalid password', () => {
    const result = authenticateUser('admin', 'wrongpassword')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.user).toBeUndefined()
  })

  it('should reject non-existent user', () => {
    const result = authenticateUser('nonexistent', 'password')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should create a new user', () => {
    const result = createUser({
      username: 'testuser',
      fullName: 'Usuario de Prueba',
      password: 'test123',
      role: 'reception',
    })
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user!.username).toBe('testuser')
    expect(result.user!.role).toBe('reception')
    expect(result.user!.isActive).toBe(true)
  })

  it('should not create duplicate username', () => {
    const result = createUser({
      username: 'testuser',
      fullName: 'Otro Usuario',
      password: 'test456',
      role: 'trainer',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Ya existe')
  })

  it('should authenticate newly created user', () => {
    const result = authenticateUser('testuser', 'test123')
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user!.username).toBe('testuser')
  })

  it('should get all users', () => {
    const result = getAllUsers()
    expect(result.data.length).toBeGreaterThanOrEqual(2)
    expect(result.data.some((u) => u.username === 'admin')).toBe(true)
    expect(result.data.some((u) => u.username === 'testuser')).toBe(true)
  })

  it('should get user by id', () => {
    const result = getAllUsers()
    const admin = result.data.find((u) => u.username === 'admin')
    expect(admin).toBeDefined()
    const found = getUserById(admin!.id)
    expect(found).not.toBeNull()
    expect(found!.username).toBe('admin')
  })

  it('should get user by username', () => {
    const found = getUserByUsername('testuser')
    expect(found).not.toBeNull()
    expect(found!.fullName).toBe('Usuario de Prueba')
  })

  it('should update a user', () => {
    const user = getUserByUsername('testuser')!
    const result = updateUser(user.id, { fullName: 'Usuario Modificado', role: 'trainer' })
    expect(result.success).toBe(true)
    expect(result.user!.fullName).toBe('Usuario Modificado')
    expect(result.user!.role).toBe('trainer')
  })

  it('should update user password and authenticate with new password', () => {
    const user = getUserByUsername('testuser')!
    updateUser(user.id, { password: 'newpass123' })
    const oldAuth = authenticateUser('testuser', 'test123')
    expect(oldAuth.success).toBe(false)
    const newAuth = authenticateUser('testuser', 'newpass123')
    expect(newAuth.success).toBe(true)
  })

  it('should not delete admin user', () => {
    const admin = getUserByUsername('admin')!
    const result = deleteUser(admin.id)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no se puede eliminar/i)
  })

  it('should delete a regular user', () => {
    const user = getUserByUsername('testuser')!
    const result = deleteUser(user.id)
    expect(result.success).toBe(true)
    const found = getUserById(user.id)
    expect(found).toBeNull()
  })

  it('should return null for non-existent username', () => {
    const found = getUserByUsername('__NONEXISTENT__')
    expect(found).toBeNull()
  })

  it('should flag mustChangePassword when admin still uses the default password', () => {
    // La migración 011 marca must_change_password=1 cuando el admin conserva
    // la contraseña por defecto (admin123), que es el caso en una instalación nueva.
    const result = authenticateUser('admin', 'admin123')
    expect(result.success).toBe(true)
    expect(result.mustChangePassword).toBe(true)
  })

  it('should clear mustChangePassword after the admin password is changed', () => {
    const admin = getUserByUsername('admin')!
    updateUser(admin.id, { password: 'secure-admin-pass' })
    clearMustChangePassword()

    const result = authenticateUser('admin', 'secure-admin-pass')
    expect(result.success).toBe(true)
    expect(result.mustChangePassword).toBe(false)

    // Restaurar credenciales por defecto para no afectar otros tests
    updateUser(admin.id, { password: 'admin123' })
    expect(authenticateUser('admin', 'admin123').success).toBe(true)
  })

  it('should verify the admin password with verifyUserPassword', () => {
    expect(verifyUserPassword('user_admin', 'admin123')).toBe(true)
    expect(verifyUserPassword('user_admin', 'wrong')).toBe(false)
    expect(verifyUserPassword('__nonexistent__', 'admin123')).toBe(false)
  })

  it('should block after max failed login attempts', () => {
    for (let i = 0; i < 5; i++) {
      const result = authenticateUser('admin', 'wrongpassword')
      expect(result.success).toBe(false)
    }
    const blocked = authenticateUser('admin', 'admin123')
    expect(blocked.success).toBe(false)
    expect(blocked.error).toContain('Demasiados intentos')
  })
})
