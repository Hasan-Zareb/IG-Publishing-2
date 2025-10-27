import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Instagram, Facebook } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, login } = useAuth()

  useEffect(() => {
    // Check for auth callback
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (token) {
      login(token)
      navigate('/')
      toast.success('Successfully logged in!')
    } else if (error) {
      toast.error('Login failed. Please try again.')
    }
  }, [searchParams, login, navigate])

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleFacebookLogin = () => {
    window.location.href = '/api/auth/facebook'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-blue-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Instagram className="mx-auto h-12 w-12 text-pink-600" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Instagram Reels Publisher
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Publish 200-500 Instagram Reels daily across multiple accounts
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Connect your Facebook account to manage Instagram Business accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleFacebookLogin}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
              size="lg"
            >
              <Facebook className="mr-2 h-5 w-5" />
              Continue with Facebook
            </Button>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our Terms of Service and Privacy Policy.
                <br />
                We'll automatically discover your Instagram Business accounts.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <div className="grid grid-cols-1 gap-4 text-sm text-gray-600">
            <div className="flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Bulk CSV import for 200-500 posts
            </div>
            <div className="flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Multi-account management
            </div>
            <div className="flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Automated scheduling
            </div>
            <div className="flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Video processing & optimization
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
