import type { User, NewUser } from "./users.repository";

export interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
  updateProfile(
    userId: string,
    patch: { email: string; username: string; displayName: string }
  ): Promise<User>;
  changePasswordAndRevokeOtherSessions(
    userId: string,
    currentSessionId: string,
    newPasswordHash: string
  ): Promise<void>;
}
