import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { queryOne } from '@/lib/db'

interface UserRow {
  id: string
  email: string
  name: string
  profile_key: string
  password_hash: string
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'E-Mail',    type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await queryOne<UserRow>(
          'SELECT u.*, up.password_hash FROM users u JOIN user_credentials up ON up.user_id = u.id WHERE u.email = $1',
          [credentials.email.toLowerCase()]
        )
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return {
          id:          user.id,
          email:       user.email,
          name:        user.name,
          profileKey:  user.profile_key,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId     = user.id
        token.profileKey = user.profileKey
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id          = token.userId as string
        session.user.profileKey  = token.profileKey as string
      }
      return session
    },
  },
}
