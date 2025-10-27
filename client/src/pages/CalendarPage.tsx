import { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Play
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../lib/api'

interface CalendarPost {
  id: number
  content: string
  scheduled_for: string
  status: string
  instagram_username: string
}

const statusConfig = {
  published: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100'
  },
  pending: { 
    icon: Clock, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-100'
  },
  processing: { 
    icon: Play, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100'
  },
  failed: { 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100'
  }
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

  const { data: posts, isLoading } = useQuery(
    ['calendar-posts', startDate, endDate],
    () => {
      const params = new URLSearchParams()
      params.append('start_date', startDate.toISOString())
      params.append('end_date', endDate.toISOString())
      return api.get(`/dashboard/calendar?${params}`).then(res => res.data.posts)
    }
  )

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const getPostsForDate = (date: Date) => {
    if (!posts) return []
    const dateStr = date.toISOString().split('T')[0]
    return posts.filter((post: CalendarPost) => 
      post.scheduled_for.startsWith(dateStr)
    )
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const days = getDaysInMonth(currentDate)
  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="mt-2 text-gray-600">
            View your posts scheduled across the calendar
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  if (!day) {
                    return <div key={index} className="h-24"></div>
                  }
                  
                  const dayPosts = getPostsForDate(day)
                  const isToday = day.toDateString() === new Date().toDateString()
                  const isSelected = selectedDate?.toDateString() === day.toDateString()
                  
                  return (
                    <div
                      key={index}
                      className={`h-24 p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                        isToday ? 'bg-blue-50' : ''
                      } ${isSelected ? 'bg-blue-100' : ''}`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isToday ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 2).map((post: CalendarPost) => {
                          const statusConfig = getStatusConfig(post.status)
                          const StatusIcon = statusConfig.icon
                          return (
                            <div
                              key={post.id}
                              className={`flex items-center space-x-1 text-xs p-1 rounded ${statusConfig.bgColor}`}
                            >
                              <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
                              <span className="truncate">{post.instagram_username}</span>
                            </div>
                          )
                        })}
                        {dayPosts.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayPosts.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Posts */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate ? selectedDate.toLocaleDateString() : 'Select a date'}
              </CardTitle>
              <CardDescription>
                {selectedDate ? `${selectedDatePosts.length} posts scheduled` : 'Click on a date to view posts'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                selectedDatePosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No posts scheduled for this date</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDatePosts.map((post: CalendarPost) => {
                      const statusConfig = getStatusConfig(post.status)
                      const StatusIcon = statusConfig.icon
                      
                      return (
                        <div
                          key={post.id}
                          className="p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-start space-x-2">
                            <StatusIcon className={`h-4 w-4 mt-0.5 ${statusConfig.color}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {post.content.substring(0, 50)}...
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-500">
                                  @{post.instagram_username}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatTime(post.scheduled_for)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p>Click on a date to view scheduled posts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
