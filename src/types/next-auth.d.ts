import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      profileKey: string
      forcePasswordChange: boolean
    }
  }
  interface User {
    profileKey: string
    forcePasswordChange: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    profileKey: string
    forcePasswordChange: boolean
  }
}
