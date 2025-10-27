import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery } from 'react-query'
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  X,
  Eye,
  Play
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface ValidationError {
  row: number
  error: string
  data: any
}

interface PostPreview {
  content: string
  media_url: string
  media_type: string
  scheduled_for: string
  instagram_account: string
  labels?: string
}

interface ImportResult {
  success: boolean
  total_posts: number
  valid_posts: number
  errors: ValidationError[]
  preview: PostPreview[]
}

export function ImportPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useQuery(
    'instagram-accounts',
    () => api.get('/instagram/accounts').then(res => res.data.accounts)
  )

  const uploadMutation = useMutation(
    (file: File) => {
      const formData = new FormData()
      formData.append('csvFile', file)
      return api.post('/csv/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    },
    {
      onSuccess: (response) => {
        setValidationResult(response.data)
        toast.success('CSV file validated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to validate CSV file')
      }
    }
  )

  const importMutation = useMutation(
    (posts: PostPreview[]) => api.post('/csv/import', { posts }),
    {
      onSuccess: (response) => {
        toast.success(`Successfully imported ${response.data.imported_count} posts!`)
        setValidationResult(null)
        setUploadedFile(null)
        setShowPreview(false)
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to import posts')
      }
    }
  )

  const downloadTemplate = () => {
    window.open('/api/csv/template', '_blank')
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setUploadedFile(file)
      uploadMutation.mutate(file)
    }
  }, [uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  })

  const handleImport = () => {
    if (validationResult?.preview) {
      importMutation.mutate(validationResult.preview)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Import Posts</h1>
        <p className="mt-2 text-gray-600">
          Upload a CSV file to bulk import Instagram Reels posts
        </p>
      </div>

      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Template</CardTitle>
          <CardDescription>
            Download the template to see the required format for your CSV file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Drag and drop your CSV file or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? 'Drop the CSV file here...'
                : 'Drag & drop a CSV file here, or click to select'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports CSV files up to 10MB
            </p>
          </div>

          {uploadedFile && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium">{uploadedFile.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUploadedFile(null)
                  setValidationResult(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              Review the validation results before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {validationResult.total_posts}
                </div>
                <div className="text-sm text-blue-600">Total Posts</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {validationResult.valid_posts}
                </div>
                <div className="text-sm text-green-600">Valid Posts</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {validationResult.errors.length}
                </div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Validation Errors:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {validationResult.errors.map((error, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-red-50 rounded">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-medium">Row {error.row}:</span>
                        <span className="text-red-700 ml-1">{error.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowPreview(!showPreview)}
                variant="outline"
                disabled={validationResult.valid_posts === 0}
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
              
              {validationResult.valid_posts > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {importMutation.isLoading ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Import {validationResult.valid_posts} Posts
                </Button>
              )}
            </div>

            {/* Preview */}
            {showPreview && validationResult.preview && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Preview (First 5 posts):</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {validationResult.preview.map((post, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {post.content.substring(0, 100)}...
                        </div>
                        <div className="text-gray-500 mt-1">
                          <div>Account: @{post.instagram_account}</div>
                          <div>Scheduled: {formatDate(post.scheduled_for)}</div>
                          <div>Media: {post.media_url}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CSV Format Help */}
      <Card>
        <CardHeader>
          <CardTitle>CSV Format Requirements</CardTitle>
          <CardDescription>
            Your CSV file must include these columns in the correct format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Column
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Format
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Example
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    content
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Text (max 2200 chars)
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    "Amazing dance! 💃 #viral #dance"
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    media_url
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Valid URL
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    "https://youtu.be/VIDEO_ID"
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    scheduled_for
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ISO Date
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    "2025-01-15 20:30"
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    instagram_account
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Username (no @)
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    "dance_account"
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    labels
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <X className="h-4 w-4 text-gray-400" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Comma-separated
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    "dance,viral"
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
