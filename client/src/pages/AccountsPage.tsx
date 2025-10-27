import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useState } from 'react'
import { 
  Users, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Instagram,
  Plus,
  Settings
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface InstagramAccount {
  id: number
  username: string
  business_account_id: string
  is_active: boolean
  follower_count: number
  profile_picture_url?: string
  created_at: string
}

export function AccountsPage() {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const queryClient = useQueryClient()

  const { data: accounts, isLoading } = useQuery<InstagramAccount[]>(
    'instagram-accounts',
    () => api.get('/instagram/accounts').then(res => res.data.accounts)
  )

  const discoverMutation = useMutation(
    () => api.get('/instagram/discover'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('instagram-accounts')
        toast.success('Instagram accounts discovered successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to discover accounts')
      },
      onSettled: () => {
        setIsDiscovering(false)
      }
    }
  )

  const toggleAccountMutation = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/instagram/accounts/${id}/toggle`, { is_active }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('instagram-accounts')
        toast.success('Account status updated!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update account')
      }
    }
  )

  const testConnectionMutation = useMutation(
    (id: number) => api.post(`/instagram/accounts/${id}/test`),
    {
      onSuccess: () => {
        toast.success('Connection test successful!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Connection test failed')
      }
    }
  )

  const handleDiscoverAccounts = () => {
    setIsDiscovering(true)
    discoverMutation.mutate()
  }

  const handleToggleAccount = (id: number, is_active: boolean) => {
    toggleAccountMutation.mutate({ id, is_active: !is_active })
  }

  const handleTestConnection = (id: number) => {
    testConnectionMutation.mutate(id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instagram Accounts</h1>
          <p className="mt-2 text-gray-600">
            Manage your connected Instagram Business accounts
          </p>
        </div>
        <Button
          onClick={handleDiscoverAccounts}
          disabled={isDiscovering}
          className="bg-pink-600 hover:bg-pink-700"
        >
          {isDiscovering ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Discover Accounts
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accounts?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Accounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accounts?.filter(acc => acc.is_active).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Instagram className="h-8 w-8 text-pink-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Followers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accounts?.reduce((sum, acc) => sum + acc.follower_count, 0).toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Your Instagram Business accounts linked to Facebook Pages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!accounts || accounts.length === 0 ? (
            <div className="text-center py-12">
              <Instagram className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Click "Discover Accounts" to find your Instagram Business accounts
              </p>
              <div className="mt-6">
                <Button onClick={handleDiscoverAccounts} disabled={isDiscovering}>
                  {isDiscovering ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Discover Accounts
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {account.profile_picture_url ? (
                        <img
                          src={account.profile_picture_url}
                          alt={account.username}
                          className="h-12 w-12 rounded-full"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center">
                          <Instagram className="h-6 w-6 text-pink-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        @{account.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        {account.follower_count.toLocaleString()} followers
                      </p>
                      <p className="text-xs text-gray-400">
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      {account.is_active ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`ml-1 text-sm font-medium ${
                        account.is_active ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(account.id)}
                      disabled={testConnectionMutation.isLoading}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    
                    <Button
                      variant={account.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleAccount(account.id, account.is_active)}
                      disabled={toggleAccountMutation.isLoading}
                    >
                      {account.is_active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
