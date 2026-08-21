/**
 * Authentication and User Profile Management Service
 * Supports Google Auth, Email/Password Login & Registration, and Role Management (ADMIN vs USER)
 */

const AUTH_STORAGE_KEY = 'blp_auth_user_v2';
const REGISTERED_USERS_KEY = 'blp_registered_users_v2';

const INITIAL_USERS = [
  {
    id: 'usr-admin-1',
    name: 'Petr M.',
    email: 'petr@blp.cz',
    passwordHash: 'admin123',
    role: 'ADMIN',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
    provider: 'email',
  },
  {
    id: 'usr-user-1',
    name: 'Honza Osvětlovač',
    email: 'jan@blp.cz',
    passwordHash: 'user123',
    role: 'USER',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
    provider: 'email',
  }
];

export const authService = {
  getUsers() {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    return JSON.parse(raw);
  },

  saveUsers(users) {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  },

  getCurrentUser() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      // Default to initial Lead Gaffer Admin user
      const users = this.getUsers();
      const admin = users.find(u => u.role === 'ADMIN') || users[0];
      this.setCurrentUser(admin);
      return admin;
    }
    return JSON.parse(raw);
  },

  setCurrentUser(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('blp_auth_changed', { detail: user }));
  },

  loginWithEmail(email, password) {
    const users = this.getUsers();
    const cleanEmail = email.toLowerCase().trim();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, error: 'Uživatel s tímto e-mailem nebyl nalezen.' };
    }

    if (user.passwordHash !== password) {
      return { success: false, error: 'Nesprávné heslo.' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  },

  registerWithEmail(name, email, password, role = 'USER') {
    const users = this.getUsers();
    const cleanEmail = email.toLowerCase().trim();

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Uživatel s tímto e-mailem již existuje.' };
    }

    const newUser = {
      id: 'usr-' + Date.now(),
      name,
      email: cleanEmail,
      passwordHash: password,
      role: role,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      provider: 'email',
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUser(newUser);

    return { success: true, user: newUser };
  },

  loginWithGoogle() {
    // Simulated Google OAuth profile
    const googleUser = {
      id: 'usr-google-' + Date.now(),
      name: 'Google Člen Štábu',
      email: 'gaffer.google@blp.cz',
      passwordHash: 'google_oauth_token',
      role: 'USER',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&h=200&q=80',
      provider: 'google',
    };

    const users = this.getUsers();
    if (!users.some(u => u.email === googleUser.email)) {
      users.push(googleUser);
      this.saveUsers(users);
    }

    this.setCurrentUser(googleUser);
    return { success: true, user: googleUser };
  },

  logout() {
    const users = this.getUsers();
    const userRole = users.find(u => u.role === 'USER') || users[1];
    this.setCurrentUser(userRole);
  }
};
