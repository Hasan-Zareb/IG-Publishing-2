import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  FileText, 
  Calendar, 
  Play, 
  Trash2, 
  Filter,
  Search,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface Post {
  id: number
  content: string
  media_url: string
  media_type: string
  scheduled_for: string
  status: string
  instagram_username: string
  container_id?: string
  published_id?: string
  error_message?: string
  labels?: string[]
  created_at: string
  updated_at: string
}

const statusConfig = {
  published: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100',
    label: 'Published'
  },
  pending: { 
    icon: Clock, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-100',
    label: 'Pending'
  },
  processing: { 
    icon: Clock, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100',
    label: 'Processing'
  },
  failed: { 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Failed'
  },
  container_created: { 
    icon: Clock, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100',
    label: 'Container Created'
  }
}

export function PostsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const queryClient = useQueryClient()

  const { data: postsData, isLoading } = useQuery(
    ['posts', statusFilter, currentPage],
    () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      params.append('page', currentPage.toString())
      params.append('limit', '20')
      return api.get(`/posts?${params}`).then(res => res.data)
    }
  )

  const publishMutation = useMutation(
    (id: number) => api.post(`/posts/${id}/publish`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('posts')
        toast.success('Post published successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to publish post')
      }
    }
  )

  const deleteMutation = useMutation(
    (id: number) => api.delete(`/posts/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('posts')
        toast.success('Post deleted successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete post')
      }
    }
  )

  const filteredPosts = postsData?.posts?.filter((post: Post) => {
    if (searchTerm) {
      return post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
             post.instagram_username.toLowerCase().includes(searchTerm.toLowerCase())
    }
    return true
  }) || []

  const handlePublish = (id: number) => {
    publishMutation.mutate(id)
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deleteMutation.mutate(id)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
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
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="mt-2 text-gray-600">
            Manage your Instagram Reels posts and publishing schedule
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      <Card>
        <CardHeader>
          <CardTitle>Posts ({filteredPosts.length})</CardTitle>
          <CardDescription>
            Your scheduled and published Instagram Reels posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No posts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms' : 'Create your first post or import from CSV'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post: Post) => {
                const statusConfig = getStatusConfig(post.status)
                const StatusIcon = statusConfig.icon
                
                return (
                  <div
                    key={post.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            @{post.instagram_username}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-900 mb-2 line-clamp-2">
                          {post.content}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(post.scheduled_for)}
                          </div>
                          {post.published_id && (
                            <div className="text-green-600">
                              Published: {post.published_id}
                            </div>
                          )}
                          {post.error_message && (
                            <div className="text-red-600">
                              Error: {post.error_message}
                            </div>
                          )}
                        </div>

                        {post.labels && post.labels.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {post.labels.map((label, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {post.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(post.id)}
                            disabled={publishMutation.isLoading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Publish
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(post.id)}
                          disabled={deleteMutation.isLoading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {postsData?.pagination && postsData.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing page {postsData.pagination.page} of {postsData.pagination.pages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(postsData.pagination.pages, prev + 1))}
              disabled={currentPage === postsData.pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
