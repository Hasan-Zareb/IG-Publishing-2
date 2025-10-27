import { useQuery } from 'react-query'
import { 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'

interface DashboardStats {
  totalPosts: number
  statusStats: Record<string, number>
  todayPosts: number
  weekPosts: number
  activeAccounts: number
}

interface RecentPost {
  id: number
  content: string
  scheduled_for: string
  status: string
  instagram_username: string
}

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>(
    'dashboard-stats',
    () => api.get('/dashboard/stats').then(res => res.data.stats)
  )

  const { data: recentPosts, isLoading: postsLoading } = useQuery<RecentPost[]>(
    'recent-posts',
    () => api.get('/dashboard/stats').then(res => res.data.recentPosts)
  )

  if (statsLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const statusColors = {
    published: 'text-green-600',
    pending: 'text-yellow-600',
    processing: 'text-blue-600',
    failed: 'text-red-600',
    container_created: 'text-purple-600'
  }

  const statusIcons = {
    published: CheckCircle,
    pending: Clock,
    processing: Clock,
    failed: AlertCircle,
    container_created: Clock
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of your Instagram Reels publishing activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              All time posts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAccounts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Instagram accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Posts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekPosts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Posts this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      {stats?.statusStats && (
        <Card>
          <CardHeader>
            <CardTitle>Posts by Status</CardTitle>
            <CardDescription>
              Current status of all your posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(stats.statusStats).map(([status, count]) => {
                const Icon = statusIcons[status as keyof typeof statusIcons] || Clock
                return (
                  <div key={status} className="text-center">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-2`}>
                      <Icon className={`h-6 w-6 ${statusColors[status as keyof typeof statusColors] || 'text-gray-600'}`} />
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {status.replace('_', ' ')}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>
              Your latest scheduled posts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPosts?.slice(0, 5).map((post) => {
                const Icon = statusIcons[post.status as keyof typeof statusIcons] || Clock
                return (
                  <div key={post.id} className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${statusColors[post.status as keyof typeof statusColors] || 'text-gray-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.content.substring(0, 50)}...
                      </p>
                      <p className="text-sm text-gray-500">
                        @{post.instagram_username} • {new Date(post.scheduled_for).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      post.status === 'published' ? 'bg-green-100 text-green-800' :
                      post.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      post.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {post.status.replace('_', ' ')}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" className="w-full">
                <Link to="/posts">View All Posts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/import">
                <FileText className="mr-2 h-4 w-4" />
                Import CSV Posts
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/accounts">
                <Users className="mr-2 h-4 w-4" />
                Manage Accounts
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                View Calendar
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
